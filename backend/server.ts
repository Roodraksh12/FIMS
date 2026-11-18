import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { randomUUID } from "node:crypto";
import { type State } from "../shared/domain.ts";
import {
  allow,
  principal,
  visiblePlans,
  withSession,
  type Session,
} from "./gateway.ts";
import {
  load,
  reset,
  provisionCredentials,
  verifyPassword,
} from "./repository.ts";
import { Services, reminderCandidates } from "./services.ts";

await provisionCredentials();
const loginAttempts = new Map<string, { count: number; until: number }>();
const sessions = new Map<string, Session & { expiresAt: number }>();
// API ACTIONS: This list maps allowed client action names to the expected argument types.
const operations = {
  reminders: [],
  completeTraining: ["string", "boolean"],
  reviewDocument: ["string", "boolean", "string"],
  reviewMentorship: ["string", "boolean", "string", "number?"],
  meeting: ["string", "string"],
  attendance: ["string", "string", "boolean"],
  waiver: ["string", "string"],
  submit: ["string"],
  returnDossier: ["string", "string"],
  approve: ["string", "string"],
  assign: ["string", "string", "string"],
  createSession: ["string", "string", "string", "boolean"],
  onboard: ["string", "string", "string", "string", "string?"],
  updateUser: ["string", "string", "boolean"],
  template: ["string", "string", "boolean", "string?"],
  readNotification: ["string"],
} satisfies Partial<Record<keyof Services, string[]>>;

async function body(request: IncomingMessage, limit: number) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > limit) {
      request.resume();
      throw new Error("The request exceeds the allowed size.");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, value: unknown) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(value));
}

// Build the workspace sent to the browser. Limit plans and related records to the signed-in user's scope.
function workspace(state: State, signedIn: boolean) {
  const user = signedIn ? principal(state) : undefined;
  const plans = user ? visiblePlans(state, user) : [];
  const planIds = new Set(plans.map((plan) => plan.id));
  const tasks = state.tasks.filter((task) => planIds.has(task.planId));
  const taskIds = new Set(tasks.map((task) => task.id));
  const facultyIds = new Set(plans.map((plan) => plan.facultyId));
  const staff = user?.role === "HR_COORDINATOR" || user?.role === "ADMIN";
  return {
    ...state,
    currentUser: user ?? null,
    remindersDue: user ? reminderCandidates(state, user).length > 0 : false,
    plans,
    tasks,
    faculty: state.faculty.filter(
      (profile) => staff || facultyIds.has(profile.id),
    ),
    assignments: state.assignments.filter((item) =>
      facultyIds.has(item.facultyId),
    ),
    interactions: state.interactions.filter((item) => taskIds.has(item.taskId)),
    documents: state.documents
      .filter((item) => taskIds.has(item.taskId))
      .map(({ blob, ...item }) => item),
    certificates: state.certificates
      .filter((item) => planIds.has(item.planId))
      .map(({ blob, ...item }) => item),
    dossiers: state.dossiers.filter((item) => planIds.has(item.planId)),
    attendance: state.attendance.filter((item) =>
      facultyIds.has(item.facultyId),
    ),
    notifications: state.notifications.filter(
      (item) => item.userId === user?.id,
    ),
    audit: user
      ? state.audit.filter(
          (item) =>
            staff || item.actorId === user.id || taskIds.has(item.entityId),
        )
      : [],
  };
}

// HTTP ROUTES: Match the request method and path, confirm the session, then call the relevant service.
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  const token =
    request.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? "";
  const storedSession = sessions.get(token);
  if (storedSession && storedSession.expiresAt <= Date.now())
    sessions.delete(token);
  const session = sessions.get(token) ?? null;
  try {
    await withSession(session, async () => {
      const route = request.method + " " + url.pathname;
      if (route === "GET /api/health")
        return json(response, 200, { status: "ok" });
      // SIGN-IN: Verify credentials before issuing an expiring session.
      if (route === "POST /api/session") {
        const input = JSON.parse((await body(request, 8192)).toString());
        const state = await load();
        if (
          typeof input?.email !== "string" ||
          typeof input?.password !== "string" ||
          input.password.length > 256 ||
          input.email.length > 254
        ) {
          return json(response, 401, { error: "Invalid email or password." });
        }
        const loginKey = input.email.trim().toLowerCase();
        const previousAttempt = loginAttempts.get(loginKey);
        if (previousAttempt && previousAttempt.until <= Date.now())
          loginAttempts.delete(loginKey);
        if ((loginAttempts.get(loginKey)?.count ?? 0) >= 10)
          return json(response, 429, {
            error: "Too many sign-in attempts. Try again in 15 minutes.",
          });
        const user = state.users.find(
          (account) =>
            account.active &&
            account.email.toLowerCase() === input.email.trim().toLowerCase(),
        );
        if (!user || !verifyPassword(user.id, input.password)) {
          const attempt = loginAttempts.get(loginKey) ?? {
            count: 0,
            until: Date.now() + 15 * 60 * 1000,
          };
          attempt.count++;
          loginAttempts.set(loginKey, attempt);
          return json(response, 401, { error: "Invalid email or password." });
        }
        loginAttempts.delete(loginKey);
        const nextToken = randomUUID();
        sessions.delete(token);
        sessions.set(nextToken, {
          userId: user.id,
          version: user.sessionVersion,
          nonce: nextToken,
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        });
        return json(response, 200, { token: nextToken, user });
      }
      if (route === "DELETE /api/session") {
        sessions.delete(token);
        return json(response, 200, null);
      }

      const state = await load();
      if (session) {
        try {
          principal(state);
        } catch {
          sessions.delete(token);
          return json(response, 401, {
            error: "Your session has expired. Please log in again.",
          });
        }
      } else if (token || route !== "GET /api/state") {
        return json(response, 401, { error: "Please log in again." });
      }

      if (route === "GET /api/state") {
        if (!session)
          return json(response, 401, { error: "Please log in again." });
        return json(response, 200, workspace(state, Boolean(session)));
      }
      if (route === "POST /api/reset") {
        allow(principal(state), "ADMIN");
        await reset();
        sessions.clear();
        return json(response, 200, null);
      }

      const version = Number(url.searchParams.get("version"));
      if (!url.searchParams.has("version") || !Number.isSafeInteger(version)) {
        return json(response, 400, {
          error: "A valid record version is required.",
        });
      }
      const service = new Services(version);
      // Uploads use raw file bytes. The service checks the allowed formats and the task's current status.
      if (route === "POST /api/uploads") {
        const bytes = await body(request, 5 * 1024 * 1024);
        const taskId = url.searchParams.get("taskId") ?? "";
        const name = url.searchParams.get("name") ?? "";
        await service.upload(
          taskId,
          new File([new Uint8Array(bytes)], name, {
            type: request.headers["content-type"],
          }),
        );
        return json(response, 200, null);
      }
      if (route === "GET /api/document" || route === "GET /api/certificate") {
        const id = url.searchParams.get("id") ?? "";
        const record =
          route === "GET /api/document"
            ? await service.document(id)
            : await service.certificate(id);
        return json(response, 200, {
          ...record,
          blob: {
            bytes: Buffer.from(await record.blob.arrayBuffer()).toString(
              "base64",
            ),
            type: record.blob.type,
          },
        });
      }
      // Route normal actions to the allowlist above. Reject missing or incorrectly typed arguments before calling the service.
      const operation = url.pathname.split("/").at(-1) ?? "";
      if (
        request.method === "POST" &&
        url.pathname === "/api/actions/" + operation &&
        Object.hasOwn(operations, operation)
      ) {
        const name = operation as keyof typeof operations;
        const args = JSON.parse((await body(request, 64 * 1024)).toString());
        const types = operations[name];
        if (
          !Array.isArray(args) ||
          args.length > types.length ||
          types.some(
            (type, i) =>
              !(type.endsWith("?") && args[i] == null) &&
              typeof args[i] !== type.replace("?", ""),
          )
        ) {
          return json(response, 400, { error: "Invalid action inputs." });
        }
        const action = service[name] as (
          ...inputs: never[]
        ) => Promise<unknown>;
        await action.apply(
          service,
          args.map((arg) => arg ?? undefined) as never[],
        );
        if (name === "onboard") await provisionCredentials();
        return json(response, 200, null);
      }
      return json(response, 404, { error: "Unknown API route." });
    });
  } catch (error) {
    json(response, 400, {
      error:
        error instanceof Error
          ? error.message
          : "Could not complete the request.",
    });
  }
});

const port = Number(process.env.FIMS_API_PORT ?? "4174");
server.listen(port, "127.0.0.1", () =>
  console.log(`FIMS API listening on http://127.0.0.1:${port}`),
);
