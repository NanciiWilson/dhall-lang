import * as d from "./util/document.js";
import * as Main from "./pages/main.js";
import { NetworkList } from "./lib/near-api-lite/network.js";

import { addListeners as CreateUser_addListeners } from "./pages/create-pass.js";
import { addListeners as ChangePass_addListeners } from "./pages/change-pass.js";
import { addListeners as ImportOrCreate_addListeners } from "./pages/import-or-create.js";
import {
  addListeners as Import_addListeners,
  onNetworkChanged as Import_onNetworkChanged,
} from "./pages/import.js";

import { refreshSelectedAccountAndAssets, selectAccountPopupList, selectedAccountData, show } from "./pages/account-selected.js";
import { show as UnlockPage_show } from "./pages/unlock.js";
import { getAccountsForPopupList, show as AddressBook_show } from "./pages/address-book.js";
import { show as Options_show } from "./pages/options.js";

import { localStorageRemove, localStorageSet } from "./data/local-storage.js";
import {
  askBackground,
  askBackgroundGetNetworkInfo,
  askBackgroundGetState,
  askBackgroundIsLocked,
  askBackgroundSetNetwork,
} from "./askBackground.js";
import { functionCall } from "./lib/near-api-lite/transaction.js";
import { isValidEmail } from "./lib/near-api-lite/utils/valid.js";

import type { NetworkInfo } from "./lib/near-api-lite/network.js";
import { hideOkCancel, OkCancelInit } from "./util/okCancel.js";
import { closePopupList, initPopupHandlers } from "./util/popup-list.js";
import { log, logEnabled } from "./lib/log.js";
import { fetchNearDollarPrice } from "./data/price-data.js";
import { activeNetworkInfo } from "./askBackground.js";

export const SINGLE_USER_EMAIL = "unique-user@narwallets.com"

const AUTO_LOCK_SECONDS = 15; //auto-lock wallet after 1hr

//--- content sections at MAIN popup.html

const IMPORT_OR_CREATE = "import-or-create";

const TYPE = "type";
const NAME = "name";
const BALANCE = "balance";
const STAKED = "staked";
const AVAILABLE = "available";

const SELECT_NETWORK = "select-network";
const DATA_CODE = "data-code";
const NETWORKS_LIST = "networks-list";

let isDark = true;

export let hamb: d.El;
let aside: d.El;

let hambIsOpen = false;

function updateNetworkIndicatorVisualState() {
  const currentNetworkDisplayName = new d.El("#current-network-display-name");
  currentNetworkDisplayName.innerText = activeNetworkInfo.displayName; //set name
  currentNetworkDisplayName.el.className = "circle " + activeNetworkInfo.color; //set indicator color
}

export function setIsDark(d: boolean) {
  isDark = d
}

async function networkItemClicked(e: Event) {
  try {
    OkCancelInit();
    hideOkCancel();
    //console.log("networkItemClicked",e)
    if (!e.target) return;

    if (!(e.target instanceof HTMLElement)) return;
    const networkName = e.target.getAttribute(DATA_CODE);
    if (!networkName) return;

    //close dropdown
    d.byId(NETWORKS_LIST).classList.remove(d.OPEN); //hides

    //update global state (background)
    await askBackgroundSetNetwork(networkName);
    //update indicator visual state
    updateNetworkIndicatorVisualState();
    Import_onNetworkChanged();

    // Account_onNetworkChanged(activeNetworkInfo);
    //on network-change restart the page-flow
    localStorageRemove("reposition");
    Main.show(); // restart page-flow
  } catch (ex) {
    d.showErr(ex.message);
  }
}

function selectNetworkClicked(ev: Event) {
  const selectionBox = d.byId(NETWORKS_LIST);
  if (selectionBox == undefined) return;
  if (selectionBox.classList.contains(d.OPEN)) {
    d.byId(NETWORKS_LIST).classList.remove(d.OPEN); //hides
    return;
  }
  //open drop down box
  selectionBox.classList.add(d.OPEN);
  selectionBox.querySelectorAll("div.circle").forEach((div: Element) => {
    div.addEventListener(d.CLICK, networkItemClicked);
  });
}

function welcomeCreatePassClicked() {
  d.showPage(Main.CREATE_USER);
}

function hambClose() {
  if (hambIsOpen) hambClicked()
}

export function buildMRU() {
  // show MRUs
  getAccountsForPopupList().then((list) => {
    list.sort((a, b) => (b.order || 0) - (a.order || 0));
    for (let i = 1; i <= 3; i++) {
      const elem = d.qs("aside #mru-" + i)
      if (list.length >= i) {
        elem.innerText = list[i - 1].text
        elem.show()
      }
      else {
        elem.hide()
      }
    }
  }
  );
}

// TODO: Remove account-list-main
function hambClicked() {
  hamb.toggleClass("open");
  aside.toggleClass("open");
  if (!hambIsOpen) {
    buildMRU();
    d.byId("account-list-main").classList.add("hidden");
    hambIsOpen = true;
  } else {
    d.byId("account-list-main").classList.remove("hidden");
    hambIsOpen = false;
  }
}

async function asideLock() {
  await askBackground({ code: "lock" });
  hambClicked()
  hideOkCancel()
  //await UnlockPage_show();
  window.close()
}

function asideExpand() {
  chrome.windows.create({
    url: chrome.runtime.getURL("index.html"),
    state: "maximized",
  });
}

async function asideIsUnlocked() {
  hambClicked();
  const isLocked = await askBackgroundIsLocked();
  if (isLocked) {
    await UnlockPage_show();
    d.showErr("You need to unlock the wallet first");
    return false;
  }
  return true;
}

async function securityOptions() {
  Options_show();
}

function asideContact() {
  chrome.windows.create({
    url: "https://narwallets.com/contact.html",
    state: "maximized",
  });
}

function asideAbout() {
  chrome.windows.create({
    url: "https://narwallets.com",
    state: "maximized",
  });
}

async function asideOptions() {
  if (await asideIsUnlocked()) {
    closePopupList();
    securityOptions();
  }
}

async function changePassword() {
  if (await asideIsUnlocked()) {
    hideOkCancel();
    closePopupList();
    d.showPage(Main.CHANGE_PASSWORD);
    ChangePass_addListeners();
  }
}

function asideCreateUserClicked() {
  hambClicked();
  d.showPage(Main.WELCOME_NEW_USER_PAGE);
}
async function asideAddAccount() {
  if (await asideIsUnlocked()) {
    hideOkCancel();
    closePopupList();
    Main.addAccountClicked();
  }
}

async function asideChangePassword() {
  if (await asideIsUnlocked()) {
    d.showPage("change-password");
  }
}

async function asideAddressBook() {
  if (await asideIsUnlocked()) {
    hideOkCancel();
    closePopupList();
    AddressBook_show();
  }
}

export async function asideSwitchMode() {
  //close aside
  hambClicked();

  let colorMode = switchDarkLight();

  localStorageSet({ popupConfig: { lightMode: colorMode == "light" } })

}

export function switchDarkLight(): string {

  const cssLinkIndex = 0;
  var oldlink = document.getElementsByTagName("link").item(cssLinkIndex);

  var colorMode;
  var cssFile = "";
  if (isDark) {
    cssFile = "css/styles_light.css";
    colorMode = "light"
  } else {
    cssFile = "css/styles_dark.css";
    colorMode = "dark"
  }
  isDark = !isDark;

  //console.log(oldlink?.href, cssFile);
  if (oldlink && !oldlink.href.includes(cssFile)) {
    oldlink.href = cssFile;
  }

  return colorMode;
}

function selectAccountMru(event: Event) {
  try {
    // TODO: remember & select MRU accounts per network
    const accName = (event.target as HTMLElement).innerText.split("(")[0].trim()
    // log("selectAccountMru |"+accName+"|")
    if (accName) {
      hambClose()
      closePopupList()
      show(accName)
    }
  }
  catch (err) {
    console.error(err)
  }
}

//-----------------------
// initPopup
//-----------------------
document.addEventListener('DOMContentLoaded', initPopup);
async function initPopup() {

  logEnabled(1);

  // update network indicator visual state
  await askBackgroundGetNetworkInfo();
  updateNetworkIndicatorVisualState();
  Import_onNetworkChanged();

  hamb = new d.El(".hamb");
  aside = new d.El("aside");
  hamb.onClick(hambClicked);

  d.onClickId("err-div", () => {
    const errDiv = d.byId("err-div");
    while (errDiv.firstChild) errDiv.firstChild.remove();
  });

  d.onClickId(SELECT_NETWORK, selectNetworkClicked);

  //aside
  //d.qs("aside #create-user").onClick(asideCreateUserClicked);
  d.qs("aside #mru-1").onClick(selectAccountMru);
  d.qs("aside #mru-2").onClick(selectAccountMru);
  d.qs("aside #mru-3").onClick(selectAccountMru);
  d.qs("aside #other-accounts").onClick(() => { hambClose(); selectAccountPopupList() });
  d.qs("aside #add-account-side").onClick(asideAddAccount);
  d.qs("aside #address-book-side").onClick(asideAddressBook);
  d.qs("aside #lock").onClick(asideLock);
  d.qs("aside #options").onClick(asideOptions);
  d.qs("aside #contact").onClick(asideContact);
  d.qs("aside #change-password").onClick(changePassword);
  d.qs("aside #about").onClick(asideAbout);
  d.qs("aside #darkmode").onClick(asideSwitchMode);

  {
    const TEMPLATE = `<div>
      <div data-code="{name}" class="circle {color}">{displayName}</div>
    </div>`;
    const NET_LIST_CONTAINER = "network-items"
    d.clearContainer(NET_LIST_CONTAINER)
    d.populateUL(NET_LIST_CONTAINER, TEMPLATE, NetworkList);
  }

  //--init other pages
  d.onClickId("welcome-create-pass", welcomeCreatePassClicked);
  d.onClickId("open-terms-of-use", openTermsOfUseOnNewWindow);
  CreateUser_addListeners();
  ImportOrCreate_addListeners();

  Import_addListeners();

  // Account_onNetworkChanged(activeNetworkInfo);

  fetchNearDollarPrice();

  initPopupHandlers()

  // set auto-refresh based on page shown
  // first
  setTimeout(autoRefresh, 200);
  // then every 10 secs
  window.setInterval(async function () {
    autoRefresh();
  }, 10000);

  //show main page
  return Main.show();
}

let refreshing: boolean = false;
export async function autoRefresh() {

  //return; // WHILE DEBUGGING

  //console.log(refreshing ? "SKIP" : "DO", "autoRefresh enter", d.activePage, "already refreshing?", refreshing)
  if (refreshing) return;
  try {
    refreshing = true
    if (d.activePage == "account-selected" || d.activePage == "AccountAssetDetail") {
      await refreshSelectedAccountAndAssets();
    }
  }
  finally {
    refreshing = false
    //console.log("autoRefresh EXIT", d.activePage)
  }
}

function openTermsOfUseOnNewWindow() {
  // localStorageSet({
  //   reposition: "create-user",
  //   email: SINGLE_USER_EMAIL, // d.inputById("email").value,
  // });
  chrome.windows.create({
    url: "https://narwallets.com/terms.html",
  });
  return false;
}

// //event to inform background.js we're unloading (starts auto-lock timer)
// addEventListener(
//   "unload",
//   function (event) {
//     //@ts-ignore
//     background.postMessage({ code: "popupUnloading" }, "*");
//   },
//   true
// );

