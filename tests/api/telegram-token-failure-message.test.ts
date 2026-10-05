/**
 * Exercises the REAL buildAlertMessage. A token_failure alert covers two very
 * different situations and the wording has to separate them: a rejected refresh
 * token needs a human to re-import a credential, while a one-off fetch error
 * clears itself on the next cron tick. Production sent the re-import instruction
 * for both, so users were told to redo credentials that still worked.
 */

import { describe, it, expect } from "vitest";
import { buildAlertMessage } from "@/services/telegram-alert-message";

describe("buildAlertMessage — token_failure", () => {
  it("asks for a re-import only on a hard failure", () => {
    const msg = buildAlertMessage("token_failure", "KienVT", {
      error: "HTTP 401: invalid_grant",
      hard_fail: true,
    });

    expect(msg).toContain("Token Failure");
    expect(msg).toContain("KienVT");
    expect(msg).toContain("Cần re-import credential");
  });

  it("says the error is transient when the refresh token still works", () => {
    const msg = buildAlertMessage("token_failure", "KienVT", {
      error: "HTTP 401: authentication_error",
      hard_fail: false,
    });

    expect(msg).toContain("Token Fetch Error");
    expect(msg).toContain("hệ thống sẽ tự thử lại");
    expect(msg).not.toContain("re-import");
  });

  it("treats a missing hard_fail flag as transient", () => {
    const msg = buildAlertMessage("token_failure", "KienVT", { error: "fetch failed" });

    expect(msg).not.toContain("re-import");
  });

  it("escapes HTML in the seat label and error body", () => {
    const msg = buildAlertMessage("token_failure", "<b>x</b>", {
      error: "boom & <script>",
      hard_fail: true,
    });

    expect(msg).toContain("&lt;b&gt;x&lt;/b&gt;");
    expect(msg).toContain("boom &amp; &lt;script&gt;");
  });
});
