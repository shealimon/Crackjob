import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/anon";

export const RESUME_BUCKET = "resumes";

const globalForAdmin = globalThis as unknown as {
  __crackSupabaseAdmin?: SupabaseClient;
};

/** Server-only client with service role (Storage uploads). */
export function createSupabaseAdminClient() {
  if (globalForAdmin.__crackSupabaseAdmin) {
    return globalForAdmin.__crackSupabaseAdmin;
  }
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  const client = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  globalForAdmin.__crackSupabaseAdmin = client;
  return client;
}

export async function uploadResumeObject(options: {
  userId: string;
  filename: string;
  buffer: Buffer;
  contentType: string;
}) {
  const admin = createSupabaseAdminClient();
  const safeName = options.filename.replace(/[^\w.\-()+ ]+/g, "_").slice(0, 120);
  const path = `${options.userId}/${Date.now()}-${safeName}`;

  const { error: bucketError } = await admin.storage.createBucket(RESUME_BUCKET, {
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
  });
  if (
    bucketError &&
    !/already exists|duplicate|resource already/i.test(bucketError.message)
  ) {
    // Bucket may already exist — continue; real failures surface on upload.
  }

  const { error } = await admin.storage
    .from(RESUME_BUCKET)
    .upload(path, options.buffer, {
      contentType: options.contentType || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || "Failed to upload resume");
  }

  return path;
}

export async function removeResumeObject(path: string | null | undefined) {
  if (!path?.trim()) return;
  try {
    const admin = createSupabaseAdminClient();
    await admin.storage.from(RESUME_BUCKET).remove([path]);
  } catch {
    // Best-effort cleanup — do not fail the request.
  }
}
