"use strict";
let config, auth, inquiries = [];
const statusLine = document.querySelector("#admin-status");
const list = document.querySelector("#request-list");
const statuses = ["new", "contacted", "answered", "completed", "archived"];
const settings = document.querySelector("#settings-form");

function notify(text) { statusLine.textContent = text; }
function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
async function api(path, method="GET", data) {
  const options = {method,cache:"no-store",headers:{}};
  if (method !== "GET") {
    options.headers["Content-Type"] = "application/json";
    options.headers["X-CSRF-Token"] = auth.csrf;
    options.body = JSON.stringify(data || {});
  }
  const response = await fetch("api/" + path, options);
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(body.error || "Request failed. Please try again.");
  }
  return body;
}
function showLogin() {
  document.querySelector("#login-box").hidden = false;
  document.querySelector("#dashboard").hidden = true;
  document.querySelector("#admin-actions").hidden = true;
}
function render() {
  list.replaceChildren();
  document.querySelector("#stat-new").textContent = inquiries.filter(item => item.status === "new").length;
  document.querySelector("#stat-progress").textContent = inquiries.filter(item => ["contacted","answered"].includes(item.status)).length;
  document.querySelector("#stat-total").textContent = inquiries.length;
  if (!inquiries.length) list.append(element("p", "No requests yet. New website inquiries will appear here.", "empty-state"));
  inquiries.forEach(item => {
    const card = element("article", undefined, "inquiry-card");
    const content = element("div");
    content.append(element("span", item.service, "badge"));
    content.append(element("h3", item.name));
    content.append(element("p", "#" + item.id + " · " + new Date(item.created_at * 1000).toLocaleString() + (item.visit_details ? " · " + item.visit_details : ""), "meta"));
    content.append(element("p", item.message, "message"));
    const contact = element("div", undefined, "contact");
    if (item.email) {
      const email = element("a", item.email);
      email.href = "mailto:" + encodeURIComponent(item.email);
      contact.append(email);
    }
    if (item.phone) {
      const phone = element("a", item.phone);
      phone.href = "tel:" + item.phone.replace(/[^+\d]/g, "");
      contact.append(phone);
    }
    content.append(contact);
    const label = element("label", "REQUEST STATUS");
    const select = element("select");
    select.setAttribute("aria-label", "Status for request " + item.id);
    statuses.forEach(value => {
      const option = element("option", value.charAt(0).toUpperCase()+value.slice(1));
      option.value = value;
      option.selected = item.status === value;
      select.append(option);
    });
    select.addEventListener("change", async () => {
      const previous = item.status;
      select.disabled = true;
      try {
        if (!config.demo_mode) await api("inquiries/"+item.id, "PATCH", {status:select.value});
        item.status = select.value;
        render();
        notify(config.demo_mode ? "Preview updated. No customer was contacted and nothing was saved." : "Request status saved. Reply to the customer separately. Manage appointments through Fresha or the shop’s usual process.");
      } catch(error) { select.value = previous; notify(error.message); }
      finally { select.disabled = false; }
    });
    label.append(select);
    card.append(content,label);
    list.append(card);
  });
}
async function showDashboard() {
  document.querySelector("#login-box").hidden = true;
  document.querySelector("#dashboard").hidden = false;
  document.querySelector("#admin-actions").hidden = false;
  if (!config.demo_mode) inquiries = (await api("inquiries")).items;
  Object.keys(config).forEach(key => { if (settings.elements[key]) settings.elements[key].value = config[key]; });
  document.querySelector("#admin-brand").textContent = config.short_name;
  render();
}
document.querySelector("#login-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector("button");
  button.disabled = true;
  try {
    const result = await api("login", "POST", Object.fromEntries(new FormData(event.currentTarget)));
    auth.csrf = result.csrf;
    event.target.reset();
    notify("Signed in.");
    await showDashboard();
  } catch(error) { notify(error.message); }
  finally { button.disabled = false; }
});
document.querySelector("#logout-button").addEventListener("click", async () => {
  try { await api("logout", "POST"); auth = await api("session"); inquiries = []; list.replaceChildren(); showLogin(); notify("Signed out."); }
  catch(error) { notify(error.message); }
});
document.querySelector("#refresh-button").addEventListener("click", async () => {
  try { await showDashboard(); notify(config.demo_mode ? "Preview refreshed. These are fictional requests." : "Requests refreshed."); }
  catch(error) { notify(error.message); }
});
document.querySelector("#export-button").addEventListener("click", event => {
  if (config.demo_mode) { event.preventDefault(); notify("Preview only. On the installed website, this button downloads your inquiries as CSV. You can also back up the full database."); }
});
settings.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(settings));
  const button = settings.querySelector("button");
  button.disabled = true;
  try {
    if (!config.demo_mode) await api("site", "PUT", data);
    Object.assign(config,data);
    document.querySelector("#admin-brand").textContent = config.short_name;
    notify(config.demo_mode ? "Preview updated for this page only. The public concept has not changed." : "Website details saved. Reload your website to see the changes.");
  } catch(error) { notify(error.message); }
  finally { button.disabled = false; }
});
function activateTab(name) {
  ["requests","settings"].forEach(value => {
    const selected = name === value;
    document.querySelector("#"+value+"-tab").setAttribute("aria-selected", String(selected));
    document.querySelector("#"+value+"-panel").hidden = !selected;
  });
}
["requests","settings"].forEach(name => document.querySelector("#"+name+"-tab").addEventListener("click", () => activateTab(name)));
document.querySelector(".admin-tabs").addEventListener("keydown", event => {
  if (["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) {
    event.preventDefault();
    const name = event.key === "Home" ? "requests" : event.key === "End" ? "settings" : event.target.id === "requests-tab" ? "settings" : "requests";
    activateTab(name);
    document.querySelector("#"+name+"-tab").focus();
  }
});
async function initialize() {
  const response = await fetch("assets/site.json");
  if (!response.ok) throw new Error("Website settings are unavailable.");
  config = await response.json();
  if (config.demo_mode) {
    document.querySelector("#demo-admin-note").hidden = false;
    document.querySelector("#logout-button").hidden = true;
    inquiries = [
      {id:103,created_at:1789198200,name:"Sample Customer A",email:"sample-a@example.com",phone:"",visit_details:"Sample haircut question",service:"Haircut question",message:"Fictional preview: Could you advise on choosing a haircut service?",status:"new"},
      {id:102,created_at:1789192800,name:"Sample Customer B",email:"sample-b@example.com",phone:"",visit_details:"Sample beard trim question",service:"Beard or shave question",message:"Fictional preview: Could you advise on a beard trim?",status:"contacted"},
      {id:101,created_at:1789117200,name:"Sample Customer C",email:"sample-c@example.com",phone:"",visit_details:"",service:"Something else",message:"Fictional preview: Thank you for calling. We agreed to a visit on Tuesday.",status:"answered"}
    ];
    await showDashboard();
  } else {
    auth = await api("session");
    if (auth.authenticated) await showDashboard(); else showLogin();
  }
}
initialize().catch(error => notify(error.message));
