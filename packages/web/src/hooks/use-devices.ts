import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { toast } from "sonner";

export interface Device {
  _id: string;
  device_id: string;
  device_name: string;
  hostname: string;
  api_key_prefix: string;
  app_version: string | null;
  last_seen_at: string | null;
  last_ram_used_mb: number | null;
  revoked_at: string | null;
  created_at: string;
  system_info?: {
    os_name?: string;
    os_version?: string;
    cpu_name?: string;
    cpu_cores?: number;
    ram_total_mb?: number;
    arch?: string;
  };
}

export interface CreatedDeviceResponse {
  device: Device;
  api_key: string; // plaintext, returned ONCE
}

const KEY = ["devices"] as const;

export function useDevices() {
  return useQuery<{ devices: Device[] }>({
    queryKey: KEY,
    queryFn: () => api.get("/api/devices"),
  });
}

export function useCreateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { device_name?: string; hostname?: string }) =>
      api.post<CreatedDeviceResponse>("/api/devices", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Đã tạo device");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRevokeDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/devices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      toast.success("Đã thu hồi device");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
