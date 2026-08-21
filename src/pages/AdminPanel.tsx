import React, { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import {
  adminCreateSchool,
  adminCreateSchoolChain,
  adminInviteChainAdmin,
  adminInviteSchoolAdmin,
  loadPlatformTenancy,
} from "../closed-loop/data";

export function AdminPanel() {
  const { isAdmin } = useAuth() as any;
  const [userCount, setUserCount] = useState<number | null>(null);
  const [planCount, setPlanCount] = useState<number | null>(null);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [emailExtensions, setEmailExtensions] = useState<string[]>([]);
  const [newExtension, setNewExtension] = useState("");
  const [extLoading, setExtLoading] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);
  const [dailyDate, setDailyDate] = useState<string>("");
  const [dailyTarget, setDailyTarget] = useState<number>(30);
  const [dailyDryRun, setDailyDryRun] = useState<boolean>(true);
  const [dailyLoading, setDailyLoading] = useState<boolean>(false);
  const [dailyResult, setDailyResult] = useState<any | null>(null);
  const [ingestJson, setIngestJson] = useState("");
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestResult, setIngestResult] = useState<any | null>(null);

  const [tenancy, setTenancy] = useState<{ chains: any[]; schools: any[] }>({
    chains: [],
    schools: [],
  });
  const [tenancyNotice, setTenancyNotice] = useState("");
  const [tenancyError, setTenancyError] = useState("");
  const [tenancySaving, setTenancySaving] = useState(false);
  const [chainName, setChainName] = useState("");
  const [chainCode, setChainCode] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [schoolChainId, setSchoolChainId] = useState("");
  const [schoolPlan, setSchoolPlan] = useState("pilot");
  const [schoolSeats, setSchoolSeats] = useState(100);
  const [inviteChainId, setInviteChainId] = useState("");
  const [inviteChainEmail, setInviteChainEmail] = useState("");
  const [inviteSchoolId, setInviteSchoolId] = useState("");
  const [inviteSchoolEmail, setInviteSchoolEmail] = useState("");

  useEffect(() => {
    if (isAdmin) {
      fetchAdminStats();
      fetchEmailExtensions();
      refreshTenancy();
    }
  }, [isAdmin]);

  const refreshTenancy = async () => {
    try {
      const data = await loadPlatformTenancy();
      setTenancy(data);
      if (!schoolChainId && data.chains[0]?.id)
        setSchoolChainId(data.chains[0].id);
      if (!inviteChainId && data.chains[0]?.id)
        setInviteChainId(data.chains[0].id);
      if (!inviteSchoolId && data.schools[0]?.id)
        setInviteSchoolId(data.schools[0].id);
    } catch (error: any) {
      setTenancyError(error?.message || "Could not load schools and chains.");
    }
  };

  const runTenancy = async (action: () => Promise<any>, success: string) => {
    setTenancySaving(true);
    setTenancyError("");
    setTenancyNotice("");
    try {
      await action();
      setTenancyNotice(success);
      await refreshTenancy();
    } catch (error: any) {
      setTenancyError(error?.message || "Tenancy action failed.");
    } finally {
      setTenancySaving(false);
    }
  };

  const fetchAdminStats = async () => {
    setLoading(true);
    // Fetch user count
    const { count: userCount } = await supabase
      .from("user_profiles")
      .select("id", { count: "exact", head: true });
    // Fetch study plan count
    const { count: planCount } = await supabase
      .from("exam_plans")
      .select("id", { count: "exact", head: true });
    // Fetch recent users
    const { data: recentUsers } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, created_at, is_admin")
      .order("created_at", { ascending: false })
      .limit(10);
    setUserCount(userCount ?? null);
    setPlanCount(planCount ?? null);
    setRecentUsers(recentUsers ?? []);
    setLoading(false);
  };

  // Fetch allowed email extensions
  const fetchEmailExtensions = async () => {
    setExtLoading(true);
    const { data, error } = await supabase
      .from("premium_email_extensions")
      .select("extension")
      .order("extension", { ascending: true });
    setEmailExtensions(data ? data.map((row: any) => row.extension) : []);
    setExtLoading(false);
  };

  // Add a new email extension
  const handleAddExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtension.trim()) return;
    setExtLoading(true);
    const ext = newExtension.trim();
    await supabase.from("premium_email_extensions").insert({ extension: ext });
    setNewExtension("");
    fetchEmailExtensions();
    setExtLoading(false);
  };

  // Debounced search effect
  useEffect(() => {
    if (!isAdmin) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!search) {
      // If search is cleared, show recent users
      fetchAdminStats();
      return;
    }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, email, created_at, is_admin")
        .or(`full_name.ilike.%${search}%,email.ilike.%${search}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      setRecentUsers(data ?? []);
      setSearching(false);
    }, 300);
    // Cleanup
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, isAdmin]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-500 font-bold">
        Access denied. Admins only.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-6">Admin Panel</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-800/70 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-blue-400">
              {userCount ?? "-"}
            </div>
            <div className="text-gray-300 mt-2">Total Users</div>
          </div>
          <div className="bg-gray-800/70 rounded-xl p-6 text-center">
            <div className="text-4xl font-bold text-green-400">
              {planCount ?? "-"}
            </div>
            <div className="text-gray-300 mt-2">Total Study Plans</div>
          </div>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Build Daily Question Pools
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Date (YYYY-MM-DD)
              </label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                className="px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 w-full"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">
                Target per Subject
              </label>
              <input
                type="number"
                min={1}
                max={500}
                value={dailyTarget}
                onChange={(e) =>
                  setDailyTarget(
                    Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                  )
                }
                className="px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 w-full"
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="inline-flex items-center gap-2 text-gray-300">
                <input
                  type="checkbox"
                  checked={dailyDryRun}
                  onChange={(e) => setDailyDryRun(e.target.checked)}
                />
                Dry Run
              </label>
            </div>
          </div>
          <button
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-50"
            disabled={dailyLoading}
            onClick={async () => {
              try {
                setDailyLoading(true);
                setDailyResult(null);
                const {
                  data: { session },
                } = await supabase.auth.getSession();
                if (!session) throw new Error("Not authenticated");
                const { data, error } = await supabase.functions.invoke(
                  "build-daily-pools",
                  {
                    body: {
                      date: dailyDate || undefined,
                      target_count: dailyTarget,
                      dry_run: dailyDryRun,
                    },
                    headers: {
                      Authorization: `Bearer ${session.access_token}`,
                    },
                  },
                );
                if (error) throw error;
                setDailyResult(data);
              } catch (e: any) {
                setDailyResult({
                  error: e?.message || "Failed to run daily pools",
                });
              } finally {
                setDailyLoading(false);
              }
            }}
          >
            {dailyLoading ? "Running…" : "Run Build (Daily)"}
          </button>
          {dailyResult && (
            <div className="mt-4 text-sm text-gray-200 whitespace-pre-wrap bg-gray-900/60 rounded-lg p-3 border border-gray-700 overflow-auto max-h-64">
              {JSON.stringify(dailyResult, null, 2)}
            </div>
          )}
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Ingest Coaching Materials (Question Metadata)
          </h2>
          <p className="text-sm text-gray-300 mb-3">
            Paste a JSON array of questions. Each object should have:
            source_type, source_id, difficulty, expected_time_sec,
            question_text, solution_text, marks, tags[], exam_type.
          </p>
          <textarea
            value={ingestJson}
            onChange={(e) => setIngestJson(e.target.value)}
            placeholder={`[\n  {\n    "source_type": "dpp",\n    "source_id": "Allen-DPP-01",\n    "difficulty": "medium",\n    "expected_time_sec": 120,\n    "question_text": "A block of mass 2kg...",\n    "solution_text": "Using F=ma...",\n    "marks": 4,\n    "tags": ["Newton's Laws", "Friction"]\n  }\n]`}
            rows={6}
            className="px-3 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 w-full mb-3 font-mono text-sm"
          />
          <button
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
            disabled={ingestLoading || !ingestJson.trim()}
            onClick={async () => {
              try {
                setIngestLoading(true);
                setIngestResult(null);
                const questions = JSON.parse(ingestJson);
                const { data, error } = await supabase.functions.invoke(
                  "bulk-ingest-questions",
                  { body: { questions } },
                );
                if (error) throw error;
                setIngestResult(data);
                setIngestJson("");
              } catch (e: any) {
                setIngestResult({ error: e?.message || "Ingest failed" });
              } finally {
                setIngestLoading(false);
              }
            }}
          >
            {ingestLoading ? "Ingesting…" : "Bulk Ingest Questions"}
          </button>
          {ingestResult && (
            <div className="mt-4 text-sm text-gray-200 whitespace-pre-wrap bg-gray-900/60 rounded-lg p-3 border border-gray-700 overflow-auto max-h-64">
              {JSON.stringify(ingestResult, null, 2)}
            </div>
          )}
        </div>
        <div className="mb-4 flex justify-end">
          <input
            type="text"
            value={search}
            onChange={handleSearch}
            placeholder="Search users by name or email..."
            className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 w-full md:w-80"
            disabled={searching}
          />
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-2">
            Schools & Chains
          </h2>
          <p className="text-sm text-gray-400 mb-4">
            Platform-first provisioning: create a chain, attach campuses with a
            plan, then provision chain heads and principals.
          </p>
          {(tenancyNotice || tenancyError) && (
            <div
              className={`mb-4 rounded-lg border p-3 text-sm ${tenancyError ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"}`}
            >
              {tenancyError || tenancyNotice}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <form
              className="space-y-2 rounded-lg border border-gray-700 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                runTenancy(async () => {
                  await adminCreateSchoolChain(chainName, chainCode);
                  setChainName("");
                  setChainCode("");
                }, "Chain created.");
              }}
            >
              <h3 className="font-semibold text-white">Create chain</h3>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="Chain name"
                value={chainName}
                onChange={(e) => setChainName(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="CODE"
                value={chainCode}
                onChange={(e) => setChainCode(e.target.value)}
                required
              />
              <button
                disabled={tenancySaving}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create chain
              </button>
            </form>

            <form
              className="space-y-2 rounded-lg border border-gray-700 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                runTenancy(async () => {
                  await adminCreateSchool({
                    name: schoolName,
                    code: schoolCode,
                    domain: schoolDomain,
                    chainId: schoolChainId || null,
                    plan: schoolPlan,
                    seatCount: schoolSeats,
                  });
                  setSchoolName("");
                  setSchoolCode("");
                  setSchoolDomain("");
                }, "School created with entitlement.");
              }}
            >
              <h3 className="font-semibold text-white">Create school</h3>
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="School name"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="School code"
                value={schoolCode}
                onChange={(e) => setSchoolCode(e.target.value)}
                required
              />
              <input
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="domain.org"
                value={schoolDomain}
                onChange={(e) => setSchoolDomain(e.target.value)}
              />
              <select
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                value={schoolChainId}
                onChange={(e) => setSchoolChainId(e.target.value)}
              >
                <option value="">No chain</option>
                {tenancy.chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                  value={schoolPlan}
                  onChange={(e) => setSchoolPlan(e.target.value)}
                >
                  {["pilot", "basic", "premium", "enterprise"].map((plan) => (
                    <option key={plan} value={plan}>
                      {plan}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                  value={schoolSeats}
                  onChange={(e) => setSchoolSeats(Number(e.target.value) || 1)}
                />
              </div>
              <button
                disabled={tenancySaving}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Create school
              </button>
            </form>

            <form
              className="space-y-2 rounded-lg border border-gray-700 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                runTenancy(async () => {
                  await adminInviteChainAdmin(inviteChainId, inviteChainEmail);
                  setInviteChainEmail("");
                }, "Chain-head access provisioned and invitation sent.");
              }}
            >
              <h3 className="font-semibold text-white">Provision chain head</h3>
              <select
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                value={inviteChainId}
                onChange={(e) => setInviteChainId(e.target.value)}
                required
              >
                <option value="">Chain</option>
                {tenancy.chains.map((chain) => (
                  <option key={chain.id} value={chain.id}>
                    {chain.name}
                  </option>
                ))}
              </select>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="head@group.org"
                value={inviteChainEmail}
                onChange={(e) => setInviteChainEmail(e.target.value)}
                required
              />
              <button
                disabled={tenancySaving}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Provision chain head
              </button>
            </form>

            <form
              className="space-y-2 rounded-lg border border-gray-700 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                runTenancy(async () => {
                  await adminInviteSchoolAdmin(
                    inviteSchoolId,
                    inviteSchoolEmail,
                  );
                  setInviteSchoolEmail("");
                }, "Principal access provisioned and invitation sent.");
              }}
            >
              <h3 className="font-semibold text-white">Provision principal</h3>
              <select
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                value={inviteSchoolId}
                onChange={(e) => setInviteSchoolId(e.target.value)}
                required
              >
                <option value="">School</option>
                {tenancy.schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white"
                placeholder="principal@school.org"
                value={inviteSchoolEmail}
                onChange={(e) => setInviteSchoolEmail(e.target.value)}
                required
              />
              <button
                disabled={tenancySaving}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Provision principal
              </button>
            </form>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="mb-2 font-semibold text-white">Chains</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                {tenancy.chains.length === 0 && (
                  <li className="text-gray-400">No chains yet.</li>
                )}
                {tenancy.chains.map((chain) => (
                  <li
                    key={chain.id}
                    className="rounded-lg border border-gray-700 px-3 py-2"
                  >
                    {chain.name}{" "}
                    <span className="text-gray-400">({chain.code})</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold text-white">Schools</h3>
              <ul className="space-y-2 text-sm text-gray-200 max-h-64 overflow-auto">
                {tenancy.schools.length === 0 && (
                  <li className="text-gray-400">No schools yet.</li>
                )}
                {tenancy.schools.map((school) => (
                  <li
                    key={school.id}
                    className="rounded-lg border border-gray-700 px-3 py-2"
                  >
                    <div className="font-semibold">{school.name}</div>
                    <div className="text-xs text-gray-400">
                      {school.code || "no code"} ·{" "}
                      {school.entitlement?.plan || "no plan"} ·{" "}
                      {school.domain || "no domain"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">
            Allowed Email Extensions for Premium Access
          </h2>
          <form
            onSubmit={handleAddExtension}
            className="flex flex-col md:flex-row gap-2 mb-4"
          >
            <input
              type="text"
              value={newExtension}
              onChange={(e) => setNewExtension(e.target.value)}
              placeholder="e.g. *.stteresaschool.in"
              className="px-4 py-2 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 w-full md:w-80"
              disabled={extLoading}
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
              disabled={extLoading || !newExtension.trim()}
            >
              Add Extension
            </button>
          </form>
          {extLoading ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <ul className="list-disc list-inside text-gray-200">
              {emailExtensions.length === 0 && (
                <li>No extensions added yet.</li>
              )}
              {emailExtensions.map((ext, idx) => (
                <li key={idx}>{ext}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-gray-800/70 rounded-xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Users</h2>
          {loading || searching ? (
            <div className="text-gray-300">Loading...</div>
          ) : (
            <table className="w-full text-left text-gray-300">
              <thead>
                <tr>
                  <th className="py-2">Name</th>
                  <th className="py-2">Email</th>
                  <th className="py-2">Admin</th>
                  <th className="py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-gray-700 last:border-0"
                  >
                    <td className="py-2">{u.full_name || "N/A"}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">{u.is_admin ? "Yes" : "No"}</td>
                    <td className="py-2">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
