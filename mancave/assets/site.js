"use strict";
let siteConfig;
let sessionInfo;
const form = document.querySelector("#inquiry-form");
const message = document.querySelector("#form-status");
const submit = form.querySelector("button[type=submit]");
const menu = document.querySelector(".menu-toggle");

menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  document.querySelector("#main-nav").classList.toggle("open", open);
});
document.querySelectorAll("#main-nav a").forEach(link => link.addEventListener("click", () => {
  menu.setAttribute("aria-expanded", "false");
  document.querySelector("#main-nav").classList.remove("open");
}));
document.querySelectorAll("[data-service]").forEach(link => link.addEventListener("click", () => {
  form.elements.service.value = link.dataset.service;
}));

function showStatus(text, error=false) {
  message.textContent = text;
  message.className = error ? "error" : "success";
}

async function loadSite() {
  const response = await fetch("assets/site.json");
  if (!response.ok) throw new Error("Website details are temporarily unavailable.");
  siteConfig = await response.json();
  document.querySelectorAll("[data-site]").forEach(element => {
    if (typeof siteConfig[element.dataset.site] === "string") element.textContent = siteConfig[element.dataset.site];
  });
  const phone = siteConfig.phone.replace(/[^+\d]/g, "");
  document.querySelectorAll(".phone-link").forEach(element => element.href = "tel:" + phone);
  const maps = new URL(siteConfig.maps_url);
  if (maps.protocol === "https:" && maps.hostname === "www.google.com") {
    document.querySelectorAll(".maps-link").forEach(element => element.href = maps.href);
  }
  if (!siteConfig.demo_mode) {
    ["concept-banner","concept-footer","demo-form-note","sample-button"].forEach(id => document.getElementById(id).hidden = true);
    document.title = siteConfig.name + " | " + siteConfig.city;
    document.querySelector('meta[name="description"]').content = siteConfig.hero_text;
    document.querySelector('meta[name="robots"]').content = "index,follow";
    const sessionResponse = await fetch("api/session", {cache:"no-store"});
    if (!sessionResponse.ok) throw new Error("The request form is temporarily unavailable. Please call the shop.");
    sessionInfo = await sessionResponse.json();
  }
}

document.querySelector("#sample-button").addEventListener("click", () => {
  form.elements.name.value = "Sample Customer";
  form.elements.visit_details.value = "Sample haircut question";
  form.elements.email.value = "sample@example.com";
  form.elements.phone.value = "";
  form.elements.service.value = "Haircut question";
  form.elements.message.value = "This is a fictional sample inquiry. I would like to ask about haircut options before booking.";
  form.elements.consent.checked = true;
  showStatus("Sample details filled in. Submit to see the confirmation preview.");
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!siteConfig) { showStatus("The form is still loading. Please try again shortly.", true); return; }
  if (siteConfig.demo_mode) {
    showStatus("Demo request complete. Nothing was sent or saved. In the installed website, this request appears in your private owner dashboard and awaits staff confirmation.");
    return;
  }
  if (!sessionInfo) { showStatus("The form is temporarily unavailable. Please call the shop.", true); return; }
  const data = Object.fromEntries(new FormData(form));
  data.consent = form.elements.consent.checked;
  if (!data.email.trim() && !data.phone.trim()) { showStatus("Add your email or phone number so the shop can reply.", true); return; }
  submit.disabled = true;
  showStatus("Sending your request…");
  try {
    const response = await fetch("api/inquiries", {method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":sessionInfo.csrf},body:JSON.stringify(data)});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The request could not be sent. Please try again or call.");
    showStatus(result.message + (result.reference ? " Reference #" + result.reference + "." : ""));
    form.reset();
  } catch(error) { showStatus(error.message || "Connection failed. Please call the shop.", true); }
  finally { submit.disabled = false; }
});

loadSite().catch(error => showStatus(error.message, true));
