"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  createConversation,
  createMessage,
  createOrganization,
  createRun,
  getRunCost,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listConversations,
  listMessages,
  listOrganizations,
  listSteps,
  listWorkspaces,
  openRunStream,
  readSseStream,
  setStoredOrgId,
  setStoredWorkspaceId,
  setToken,
  type ApiMessage,
  type ApiRunCost,
  type ApiRunStep,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";
import { TimelinePanel } from "./TimelinePanel";

export function ChatApp() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [steps, setSteps] = useState<ApiRunStep[]>([]);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runTraceId, setRunTraceId] = useState<string | null>(null);
  const [runCost, setRunCost] = useState<ApiRunCost | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadMessages = useCallback(async (cid: string) => {
    const msgs = await listMessages(cid);
    setMessages(msgs);
  }, []);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    void (async () => {
      try {
        let memberships = await listOrganizations();
        if (memberships.length === 0) {
          const slug = `demo-${Date.now().toString(36)}`;
          await createOrganization("Demo Org", slug);
          memberships = await listOrganizations();
        }
        setOrgs(memberships);
        const preferredOrg = getStoredOrgId() ?? memberships[0]?.organization.id ?? null;
        setOrgId(preferredOrg);
        if (preferredOrg) setStoredOrgId(preferredOrg);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      try {
        const ws = await listWorkspaces(orgId);
        setWorkspaces(ws);
        const preferred =
          getStoredWorkspaceId() && ws.some((w) => w.id === getStoredWorkspaceId())
            ? getStoredWorkspaceId()
            : (ws[0]?.id ?? null);
        setWorkspaceId(preferred);
        if (preferred) setStoredWorkspaceId(preferred);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [orgId]);

  useEffect(() => {
    if (!workspaceId) return;
    void (async () => {
      try {
        const convs = await listConversations(workspaceId);
        let cid = convs[0]?.id ?? null;
        if (!cid) {
          const created = await createConversation(workspaceId, "Chat");
          cid = created.id;
        }
        setConversationId(cid);
        await loadMessages(cid);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [workspaceId, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const watchRun = useCallback(
    async (runId: string, cid: string) => {
      const refreshCost = async () => {
        try {
          setRunCost(await getRunCost(runId));
        } catch {
          /* projector may lag */
        }
      };

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const connect = async () => {
        try {
          // Reconstitute from REST first (reconnect-safe)
          const [freshSteps, run] = await Promise.all([
            listSteps(runId),
            (await import("@/lib/api")).getRun(runId),
          ]);
          setSteps(freshSteps);
          setRunStatus(run.status);
          const tid =
            run.metadata && typeof run.metadata.trace_id === "string"
              ? run.metadata.trace_id
              : null;
          if (tid) setRunTraceId(tid);
          await refreshCost();
          if (run.status === "completed" || run.status === "failed") {
            await loadMessages(cid);
            return;
          }

          const res = await openRunStream(runId, ac.signal);
          for await (const ev of readSseStream(res)) {
            if (ac.signal.aborted) break;
            if (ev.event === "heartbeat") continue;
            if (ev.event === "snapshot") {
              const snapSteps = ev.data.steps as ApiRunStep[] | undefined;
              if (Array.isArray(snapSteps)) setSteps(snapSteps);
              const runObj = ev.data.run as { status?: string } | undefined;
              if (runObj?.status) setRunStatus(runObj.status);
            }
            if (ev.event === "step_created" && ev.data.step) {
              const step = ev.data.step as ApiRunStep;
              setSteps((prev) => {
                if (prev.some((s) => s.id === step.id)) return prev;
                return [...prev, step].sort((a, b) => a.seq - b.seq);
              });
            }
            if (ev.event === "status_changed") {
              const runObj = ev.data.run as { status?: string } | undefined;
              if (runObj?.status) setRunStatus(runObj.status);
            }
            if (ev.event === "run_completed" || ev.event === "run_failed") {
              const runObj = ev.data.run as { status?: string } | undefined;
              if (runObj?.status) setRunStatus(runObj.status);
              await loadMessages(cid);
              setSteps(await listSteps(runId));
              await refreshCost();
              return;
            }
          }
        } catch (e) {
          if (ac.signal.aborted) return;
          await new Promise((r) => setTimeout(r, 800));
          if (!ac.signal.aborted) await connect();
          else if (e instanceof ApiError) setError(e.message);
        }
      };

      await connect();
    },
    [loadMessages],
  );

  async function onSend() {
    if (!workspaceId || !conversationId || !draft.trim() || busy) return;
    setBusy(true);
    setError(null);
    const text = draft.trim();
    setDraft("");
    try {
      const userMsg = await createMessage(conversationId, text);
      setMessages((m) => [...m, userMsg]);
      setRunCost(null);
      setRunTraceId(null);
      const { run, steps: initial } = await createRun({
        workspaceId,
        conversationId,
        goal: text,
      });
      setSteps(initial);
      setRunStatus(run.status);
      const tid =
        run.metadata && typeof run.metadata.trace_id === "string"
          ? run.metadata.trace_id
          : null;
      setRunTraceId(tid);
      await watchRun(run.id, conversationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    abortRef.current?.abort();
    setToken(null);
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          AT72 <span>Verse</span>
        </div>
        <a href="/chat" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/workflows" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Workflows
        </a>
        <a href="/persona" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Persona
        </a>
        <a href="/memory" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Memory
        </a>
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
        <a href="/quotas" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Quotas
        </a>
        <a href="/billing" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Billing
        </a>
        <a href="/privacy" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Privacy
        </a>
        <label>
          Org{" "}
          <select
            value={orgId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setOrgId(id);
              setStoredOrgId(id);
              setStoredWorkspaceId(null);
            }}
          >
            {orgs.map((o) => (
              <option key={o.organization.id} value={o.organization.id}>
                {o.organization.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace{" "}
          <select
            value={workspaceId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setWorkspaceId(id);
              setStoredWorkspaceId(id);
            }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={logout}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            borderRadius: "var(--radius)",
            padding: "0.35rem 0.65rem",
          }}
        >
          Log out
        </button>
      </header>

      {error ? (
        <div className="error" style={{ padding: "0.5rem 1.25rem" }}>
          {error}
        </div>
      ) : null}

      <div className="chat-layout">
        <section className="chat-main">
          <div className="messages">
            {messages.length === 0 ? (
              <p className="empty">
                Ask Adam to write something — e.g. « Rédige un post LinkedIn sur AT72 Verse »
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  <div className="meta">{m.role}</div>
                  {m.content}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>
          <div className="composer">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message to Adam…"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void onSend();
                }
              }}
              disabled={busy}
            />
            <button type="button" disabled={busy || !draft.trim()} onClick={() => void onSend()}>
              {busy ? "…" : "Send"}
            </button>
          </div>
        </section>
        <TimelinePanel
          steps={steps}
          runStatus={runStatus}
          cost={runCost}
          traceId={runTraceId}
          grafanaTraceUrl={
            runTraceId && process.env.NEXT_PUBLIC_GRAFANA_TRACE_URL
              ? `${process.env.NEXT_PUBLIC_GRAFANA_TRACE_URL}${encodeURIComponent(runTraceId)}`
              : null
          }
        />
      </div>
    </div>
  );
}
