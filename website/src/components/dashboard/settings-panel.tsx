"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDashboardData } from "@/components/dashboard/dashboard-data";
import { LoadingButton } from "@/components/loading-button";
import { useToast } from "@/components/toast";
import type { DashboardPayload, DashboardProfile } from "@/lib/dashboard-data";
import {
  COUNTRY_CODES,
  DEFAULT_COUNTRY_CODE,
  toPublicProfile,
} from "@/lib/profile";

function Row({
  label,
  children,
  align = "center",
}: {
  label: string;
  children: React.ReactNode;
  align?: "center" | "start";
}) {
  return (
    <div
      className={`grid gap-2 border-b border-black/6 py-4 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-6 ${
        align === "start" ? "sm:items-start" : "sm:items-center"
      }`}
    >
      <p className="text-sm text-black/55">{label}</p>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function inputClassName() {
  return "w-full max-w-md rounded-lg border border-black/12 bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/30";
}

function profileFormState(profile: DashboardProfile | undefined) {
  const p = profile ?? toPublicProfile(null);
  return {
    firstName: p.firstName ?? "",
    lastName: p.lastName ?? "",
    countryCode: p.countryCode || DEFAULT_COUNTRY_CODE,
    mobileNo: p.mobileNo ?? "",
    jobRole: p.jobRole ?? "",
    currentCompany: p.currentCompany ?? "",
    yearsOfExperience:
      p.yearsOfExperience === null || p.yearsOfExperience === undefined
        ? ""
        : String(p.yearsOfExperience),
    linkedinUrl: p.linkedinUrl ?? "",
    currentLocation: p.currentLocation ?? "",
    preferredLocations: p.preferredLocations ?? "",
    preferredStack: p.preferredStack ?? "",
  };
}

export function SettingsPanel({ initial }: { initial: DashboardPayload }) {
  const { toast } = useToast();
  const { data: live, refresh } = useDashboardData();
  const data = live ?? initial;

  const baseline = useMemo(
    () => profileFormState(data.profile),
    [data.profile],
  );
  const [form, setForm] = useState(baseline);
  const [resumeFileName, setResumeFileName] = useState(
    data.profile?.resumeFileName ?? null,
  );
  const [hasResume, setHasResume] = useState(Boolean(data.profile?.hasResume));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [desktopSession, setDesktopSession] = useState(data.desktopSession);
  const resumeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm(profileFormState(data.profile));
    setResumeFileName(data.profile?.resumeFileName ?? null);
    setHasResume(Boolean(data.profile?.hasResume));
    setDesktopSession(data.desktopSession);
  }, [data.profile, data.desktopSession]);

  const dirty = (Object.keys(baseline) as (keyof typeof baseline)[]).some(
    (key) => form[key] !== baseline[key],
  );

  function setField<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const yearsRaw = form.yearsOfExperience.trim();
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          countryCode: form.countryCode || DEFAULT_COUNTRY_CODE,
          mobileNo: form.mobileNo,
          jobRole: form.jobRole,
          currentCompany: form.currentCompany,
          yearsOfExperience: yearsRaw === "" ? null : yearsRaw,
          linkedinUrl: form.linkedinUrl,
          currentLocation: form.currentLocation,
          preferredLocations: form.preferredLocations,
          preferredStack: form.preferredStack,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        toast(body?.error || "Could not save profile.", "error");
        return;
      }
      await refresh();
      toast("Profile saved.", "success");
    } finally {
      setSaving(false);
    }
  }

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/resume/upload", {
        method: "POST",
        body,
      });
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
        profile?: DashboardProfile;
      } | null;
      if (!res.ok) {
        toast(payload?.error || "Could not upload resume.", "error");
        return;
      }
      if (payload?.profile) {
        setResumeFileName(payload.profile.resumeFileName);
        setHasResume(payload.profile.hasResume);
      }
      await refresh();
      toast("Resume uploaded.", "success");
    } finally {
      setUploading(false);
    }
  }

  async function revoke() {
    setRevoking(true);
    try {
      const res = await fetch("/api/session/desktop", { method: "DELETE" });
      if (!res.ok) {
        toast("Could not revoke the desktop session.", "error");
        return;
      }
      setDesktopSession(null);
      await refresh();
      toast("Desktop session revoked.", "success");
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-black sm:text-3xl">
          Profile
        </h1>
        <p className="mt-2 text-sm text-black/50">
          Job profile and resume used for HR, resume-based, and behavioral
          interview answers in the desktop app.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-black">Account</h2>
        <div className="mt-3 rounded-2xl border border-black/8 bg-white px-5 sm:px-6">
          <Row label="Email">
            <p className="text-sm text-black">{data.user.email || "—"}</p>
          </Row>

          <Row label="Resume / CV" align="start">
            <div className="space-y-3">
              <p className="text-sm text-black">
                {resumeFileName
                  ? resumeFileName
                  : hasResume
                    ? "Resume on file"
                    : "No resume uploaded"}
              </p>
              <input
                ref={resumeRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md,.rtf,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                className="hidden"
                onChange={(e) => {
                  void uploadResume(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-3">
                <LoadingButton
                  type="button"
                  loading={uploading}
                  loadingText="Uploading…"
                  onClick={() => resumeRef.current?.click()}
                  className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-black/[0.03] disabled:opacity-50"
                >
                  {hasResume ? "Replace resume" : "Upload resume"}
                </LoadingButton>
                <p className="text-xs text-black/40">
                  PDF, DOC, DOCX, TXT, MD, or RTF up to 8&nbsp;MB. Used for HR,
                  resume, and behavioral interview answers in the desktop app.
                </p>
              </div>
            </div>
          </Row>

          <Row label="First Name">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              className={inputClassName()}
              autoComplete="given-name"
            />
          </Row>

          <Row label="Last Name">
            <input
              type="text"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              className={inputClassName()}
              autoComplete="family-name"
            />
          </Row>

          <Row label="Mobile Number">
            <div className="flex w-full max-w-md gap-2">
              <select
                value={form.countryCode || DEFAULT_COUNTRY_CODE}
                onChange={(e) => setField("countryCode", e.target.value)}
                className="w-[9.5rem] shrink-0 rounded-lg border border-black/12 bg-white px-2 py-2 text-sm text-black outline-none focus:border-black/30"
                aria-label="Country code"
                title={
                  COUNTRY_CODES.find(
                    (c) => c.code === (form.countryCode || DEFAULT_COUNTRY_CODE),
                  )?.label
                }
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={`${c.code}-${c.label}`} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={form.mobileNo}
                onChange={(e) => setField("mobileNo", e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-black/12 bg-white px-3 py-2 text-sm text-black outline-none placeholder:text-black/35 focus:border-black/30"
                autoComplete="tel-national"
                placeholder="98765 43210"
                inputMode="tel"
              />
            </div>
          </Row>

          <Row label="Job Role">
            <input
              type="text"
              value={form.jobRole}
              onChange={(e) => setField("jobRole", e.target.value)}
              placeholder="e.g. SDE-2, Backend Engineer"
              className={inputClassName()}
            />
          </Row>

          <Row label="Current Company">
            <input
              type="text"
              value={form.currentCompany}
              onChange={(e) => setField("currentCompany", e.target.value)}
              className={inputClassName()}
            />
          </Row>

          <Row label="Years of Experience" align="start">
            <div className="w-full max-w-md">
              <input
                type="number"
                min={0}
                max={60}
                step={0.1}
                value={form.yearsOfExperience}
                onChange={(e) => setField("yearsOfExperience", e.target.value)}
                className={inputClassName()}
                placeholder="e.g. 8"
              />
              <p className="mt-1.5 text-xs text-black/45">
                Calibrates Live answer depth. If empty, years come from your resume — we never assume 5 years.
              </p>
            </div>
          </Row>

          <Row label="LinkedIn URL">
            <input
              type="url"
              value={form.linkedinUrl}
              onChange={(e) => setField("linkedinUrl", e.target.value)}
              className={inputClassName()}
              placeholder="https://linkedin.com/in/…"
            />
          </Row>

          <Row label="Current Location">
            <input
              type="text"
              value={form.currentLocation}
              onChange={(e) => setField("currentLocation", e.target.value)}
              className={inputClassName()}
              placeholder="e.g. Bengaluru"
            />
          </Row>

          <Row label="Preferred Locations">
            <input
              type="text"
              value={form.preferredLocations}
              onChange={(e) => setField("preferredLocations", e.target.value)}
              className={inputClassName()}
              placeholder="e.g. Remote, Bengaluru, Hyderabad"
            />
          </Row>

          <Row label="Preferred Stack">
            <input
              type="text"
              value={form.preferredStack}
              onChange={(e) => setField("preferredStack", e.target.value)}
              className={inputClassName()}
              placeholder="e.g. React, Node, AWS"
            />
          </Row>

          <Row label="Desktop app" align="start">
            {desktopSession ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-black">
                    {desktopSession.deviceName || "Windows overlay"}
                  </p>
                  <p className="mt-1 text-xs text-black/45">
                    Last seen{" "}
                    {new Date(desktopSession.lastSeenAt).toLocaleString("en-IN")}
                  </p>
                </div>
                <LoadingButton
                  type="button"
                  loading={revoking}
                  loadingText="Revoking…"
                  onClick={revoke}
                  className="rounded-lg border border-black/15 bg-white px-3 py-1.5 text-[13px] font-medium text-black hover:bg-black/[0.03] disabled:opacity-50"
                >
                  Revoke session
                </LoadingButton>
              </div>
            ) : (
              <p className="text-sm text-black/55">No active desktop session.</p>
            )}
          </Row>

          <Row label="Plan">
            <p className="text-sm text-black">{data.user.planLabel}</p>
          </Row>

          <div className="flex justify-end border-t border-black/6 py-4">
            <LoadingButton
              type="button"
              loading={saving}
              loadingText="Saving…"
              disabled={!dirty}
              onClick={save}
              className="rounded-lg bg-black px-4 py-2 text-[13px] font-semibold text-white hover:bg-black/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Save changes
            </LoadingButton>
          </div>
        </div>
      </section>
    </div>
  );
}
