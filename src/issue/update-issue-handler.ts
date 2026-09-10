import { updateIssue } from "../__generated__/http-client.js";
import type { updateIssueArgs } from "../__generated__/handlers.js";

// Preserve the generated request contract, but surface HTTP failures to MCP callers.
// Never retry a write: a lost response can still mean the journal/time entry was saved.
export const updateIssueHandler = async (args: updateIssueArgs) => {
  const res = await updateIssue(
    args.pathParams.issueId, args.pathParams.format, args.bodyParams,
  );
  return {
    ...(res.status >= 400 ? { isError: true } : {}),
    content: [{ type: "text" as const, text: JSON.stringify(res) }],
  };
};