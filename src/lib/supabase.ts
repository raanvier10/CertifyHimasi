import { createClient } from "@supabase/supabase-js";
import { EventItem, ParticipantItem, DownloadItem } from "@/types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://wecfeuyhvelhznqwyuoq.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_cvYQo4uv0gYZQj9v3OyJhQ_o9rFfDGd";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getEvents(): Promise<EventItem[]> {
  try {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("[Supabase] Gagal memuat tabel events:", error.message || error);
      return [];
    }
    return (data || []) as EventItem[];
  } catch (err: any) {
    console.warn("[Supabase] Pengecualian koneksi getEvents:", err?.message || err);
    return [];
  }
}

export async function getParticipants(): Promise<ParticipantItem[]> {
  try {
    const { data, error } = await supabase
      .from("participants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("[Supabase] Gagal memuat tabel participants:", error.message || error);
      return [];
    }
    return (data || []) as ParticipantItem[];
  } catch (err: any) {
    console.warn("[Supabase] Pengecualian koneksi getParticipants:", err?.message || err);
    return [];
  }
}

export async function getDownloads(): Promise<DownloadItem[]> {
  try {
    const { data, error } = await supabase
      .from("downloads")
      .select("*")
      .order("download_date", { ascending: false })
      .limit(100);

    if (error) {
      console.warn("[Supabase] Gagal memuat tabel downloads:", error.message || error);
      return [];
    }
    return (data || []) as DownloadItem[];
  } catch (err: any) {
    console.warn("[Supabase] Pengecualian koneksi getDownloads:", err?.message || err);
    return [];
  }
}

export async function recordDownload(participant: ParticipantItem, event: EventItem) {
  try {
    // 1. Insert download record
    await supabase.from("downloads").insert({
      participant_id: participant.id,
      participant_name: participant.nama,
      peran: participant.peran,
      event_id: event.id,
      event_name: event.name,
      download_date: new Date().toISOString(),
    });

    // 2. Increment download count atomically via RPC
    const { error: rpcError } = await supabase.rpc("increment_download", {
      row_id: participant.id,
    });

    // Fallback if RPC is not yet created in Supabase
    if (rpcError) {
      await supabase
        .from("participants")
        .update({ download_count: (participant.download_count || 0) + 1 })
        .eq("id", participant.id);
    }
  } catch (err) {
    console.warn("recordDownload failed:", err);
  }
}

