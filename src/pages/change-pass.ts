import { askBackground, askBackgroundGetState } from "../askBackground.js"
import { showPassword } from "../data/local-storage.js";
import * as d from "../util/document.js"
import { show as UnlockPage_show } from "./unlock.js";

const CURRENT_PASS = "current-pass";
const PASS = "new-pass"
const PASS_CONFIRM = "new-pass-confirm"
const CHANGE_PASS = "confirm-change-password"
const UNLOCK = "unlock";
const SHOW_PASSWORD_CURRENT = "show-password-current";
const SHOW_PASSWORD_NEW_CURRENT = "show-password-new-current";
const SHOW_PASSWORD_NEW_CONFIRM = "show-password-confirm";

async function changeClicked(ev: Event) {
  try {
    ev.preventDefault();


    const currentPassword = d.inputById(CURRENT_PASS).value;
    const password = d.inputById(PASS).value;
    const confirm = d.inputById(PASS_CONFIRM).value;

    if (!confirm || confirm != password) {
      throw Error("Passwords don't match")
    }

    const state = await askBackgroundGetState()
    try {
      await askBackground({
        code: "unlockSecureState",
        email: state.currentUser,
        password: currentPassword,
      });
    } catch (error) {
      d.showErr(error);
      return;
    }

    //validate email,pwd,duplicates & Create SecureState store hashedPass
    await askBackground({ code: "change-password", email: state.currentUser, password: password })
    d.showSuccess("Password changed succesfully");
    UnlockPage_show();

  }
  catch (ex) {
    d.showErr(ex.message);
  }
}

// on document load
export function addListeners() {

  d.onClickId(CHANGE_PASS, changeClicked);
  d.onClickId(SHOW_PASSWORD_CURRENT, showPassword);
  d.onClickId(SHOW_PASSWORD_NEW_CURRENT, showPassword);
  d.onClickId(SHOW_PASSWORD_NEW_CONFIRM, showPassword);
}
