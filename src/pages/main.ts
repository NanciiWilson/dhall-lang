import * as d from "../util/document.js";
import * as c from "../util/conversions.js";

import { Account, Asset, setAssetBalanceYoctos } from "../structs/account-info.js";
import { ExtendedAccountData } from "../extendedAccountData.js";
import { selectAccountPopupList, selectedAccountData, show as AccountSelectedPage_show } from "./account-selected.js";
import { show as UnlockPage_show } from "./unlock.js";

import {
  localStorageGet,
  localStorageGetAndRemove,
  localStorageRemove,
  localStorageSet,
} from "../data/local-storage.js";
import {
  accountMatchesNetwork, activeNetworkInfo,
  askBackground,
  askBackgroundAllNetworkAccounts,
  askBackgroundGetState,
  askBackgroundIsLocked,
} from "../askBackground.js";
import { D } from "../lib/tweetnacl/core/core.js";
import * as StakingPool from "../contracts/staking-pool.js";
import { asideSwitchMode, autoRefresh, hamb, setIsDark } from "../index.js";
import { hideOkCancel } from "../util/okCancel.js";

//--- content sections at MAIN popup.html
export const WELCOME_NEW_USER_PAGE = "welcome-new-user-page";
export const CREATE_USER = "create-user";
export const CHANGE_PASSWORD = "change-password";

export const UNLOCK = "unlock";

// export const ACCOUNT_LIST_MAIN = "account-list-main";
// export const ADD_ACCOUNT = "add-account";
export const IMPORT_OR_CREATE = "import-or-create";

// export const ACCOUNTS_LIST = "accounts-list";
// export const ACCOUNT_ITEM = "account-item";

let lastSelectedAccount: ExtendedAccountData | undefined;
export let lastSelectedAsset: Asset | undefined;

export function setLastSelectedAccount(data: ExtendedAccountData) {
  lastSelectedAccount = data;
}

export function setLastSelectedAsset(data: Asset) {
  lastSelectedAsset = data;
}

/*let draggingEl: HTMLElement;
function accountItem_drag(ev: Event) {
  ev.preventDefault();
  if (!draggingEl) {
    //console.log("start")
    draggingEl = ev.target as HTMLElement;
    if (draggingEl) draggingEl.classList.add("invisible");
    new d.All("li.account-item").toggleClass("unselectable");
  }
}

function accountItem_dragOver(ev: Event) {
  ev.preventDefault(); //allow drop
  //console.log("over")
  //@ts-ignore
  if (ev.target.classList.contains("account-item")) {
    //@ts-ignore
    draggingEl.parentNode.insertBefore(draggingEl, ev.target);
    //console.log("over")
  }
}
function total_dragOver() {
  if (draggingEl && draggingEl.parentNode)
    draggingEl.parentNode.appendChild(draggingEl);
}
// function accountItem_dragEnter(ev:Event){
//   //@ts-ignore
//   if (ev.target.classList.contains("account-item")){
//     //console.log("enter")
//     //ev.target.classList.add("dragover")
//   }
// }
// function accountItem_dragLeave(ev:Event){
//   //@ts-ignore
//   if (ev.target.classList.contains("account-item")){
//     //console.log("leave")
//     //ev.target.classList.remove("dragover")
//   }
// }
function accountItem_drop(ev: Event) {
  ev.preventDefault();
  //console.log("drop")
}
async function accountItem_dragend(ev: Event) {
  //console.log("dragEnd")
  ev.preventDefault();
  d.all("li.account-item");
  draggingEl.classList.remove("invisible");
  draggingEl = undefined as unknown as HTMLElement;
  //save new order
  const accountLis = d.all("li.account-item");
  accountLis.toggleClass("unselectable");
  let order = 1;
  const networkAccounts = await askBackgroundAllNetworkAccounts();
  accountLis.elems.forEach(async (li) => {
    const accInfo = networkAccounts[li.id];
    //console.log(n,accInfo.type,li.id)
    if (accInfo && accInfo.order != order) {
      await askBackground({
        code: "set-account-order",
        accountId: li.id,
        order: order,
      });
    }
    order++;
  });
}
*/

//--------------------------
// function sortByOrder(a: ExtendedAccountData, b: ExtendedAccountData) {
//   if (a.accountInfo.order > b.accountInfo.order) return 1;
//   return -1;
// }

export function addAccountClicked() {
  d.onClickId("add-account-back-to-account", backToMainPageClicked);
  d.showPage(IMPORT_OR_CREATE);
}

// async function disconnectFromWepPageClicked() {
//   const button = d.qs("#disconnect-from-web-page");
//   button.enabled = false;
//   try {
//     await askBackground({ code: "disconnect" });
//     d.showSuccess("disconnected");
//     setTimeout(function () {
//       d.qs("#disconnect-line").hide();
//       button.enabled = true;
//     }, 1000);
//   } catch (ex) {
//     d.showErr(ex.message);
//     button.enabled = true;
//   }
// }

//--------------------------
export async function show() {
  try {
    d.hideErr();

    // const selectAccountButton = new d.El("#topbar-left-button")
    // selectAccountButton.hide()

    //is locked?
    const locked = await askBackgroundIsLocked();
    if (locked) {
      hamb.hide()
      //do a user exists?
      const state = await askBackgroundGetState();
      if (state.usersList.length == 0) {
        //no users => welcome new User
        d.showPage(WELCOME_NEW_USER_PAGE);
        return; //*****
      }
      //user & locked => unlock
      await UnlockPage_show();
      return; //*****
    }

    hamb.show()

    //logged-in and with no accounts? add an account
    const countAccounts = await askBackground({
      code: "getNetworkAccountsCount",
    });
    if (countAccounts == 0) {
      d.showPage(IMPORT_OR_CREATE);
      return;
    }

    // here we have:
    // a user, unlocked, with accounts.
    
    await tryReposition();

  } catch (ex) {
    hamb.hide()
    await UnlockPage_show(); //show the unlock-page
    d.showErr(ex.message);
  } finally {
  }
}

export function backToMainPageClicked() {
  d.clearContainer("assets-list");
  show()
  hideOkCancel()
}

async function tryReposition() {
  const reposition = await localStorageGetAndRemove("reposition");
  switch (reposition) {
    case "create-user": {
      //was creating user but maybe jumped to terms-of-use
      d.showPage(CREATE_USER);
      //d.inputById("email").value = await localStorageGetAndRemove("email");
      break;
    }
    case "account":
    case "asset":
    case "stake": {
      const account = await localStorageGetAndRemove("account");
      const assetIndex = await localStorageGetAndRemove("assetIndex");
      const isLocked = await askBackgroundIsLocked();
      if (!isLocked) {
        //console.log("reposition ", account, reposition, assetIndex)
        AccountSelectedPage_show(account, reposition, assetIndex);
      }
    }
      break;
    default: {
      let account: string | undefined = await localStorageGet("lastSelectedAccountByNetwork_" + activeNetworkInfo.name)
      if (!account) account = await localStorageGet("currentAccountId")
      // in ALL cases we have to call AccountSelectedPage_show (it will show a select account popup if the account is not valid)
      AccountSelectedPage_show(account || "")
    }

  }
}

export async function backToSelectAccount() {
  //remove selected account auto-click
  localStorageRemove("account");
  localStorageRemove("currentAccountId")
  localStorageRemove("lastSelectedAccountByNetwork_" + activeNetworkInfo.name)
  if (selectedAccountData) selectedAccountData.name = ""; // mark as no account selected
  await show();
  //autoRefresh();
}

//---------------------------------------------------
//-- account item clicked => account selected Page --
//---------------------------------------------------
/*export async function accountItemClicked(ev: Event) {
  if (ev.target && ev.target instanceof HTMLElement) {
    const li = ev.target.closest("li");
    if (li) {
      const accName = li.id; // d.getClosestChildText(".account-item", ev.target, ".name");
      if (!accName) return;
      await AccountSelectedPage_show(accName, undefined);
      autoRefresh()
    }
  }
}
*/

export function updateScreen(selector: string, value: string) {
  try {
    const e = document.querySelector(selector) as HTMLElement
    if (e) {
      //console.log("updateScreen", selector, amount);
      e.innerText = value
    } else {
      console.log("WARN updateScreen selector", selector, "not found")
    }
  } catch (ex) {
    console.log("updateScreen", selector, ex)
  }
}
export function updateScreenNum(selector: string, amount: number | undefined) {
  updateScreen(selector, c.toStringDec(amount))
}
