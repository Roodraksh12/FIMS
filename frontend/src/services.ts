import type { Services as BackendServices } from "../../backend/services";
import type {
  CompletionCertificate,
  DocumentRecord,
} from "../../shared/domain";
import { post, request } from "./api";

type SpecialOperation = "upload" | "document" | "certificate";
type RemoteServices = {
  [K in Exclude<keyof BackendServices, SpecialOperation>]: (
    ...args: Parameters<BackendServices[K]>
  ) => Promise<void>;
};
type FileResponse<T> = Omit<T, "blob"> & {
  blob: { bytes: string; type: string };
};

// FRONTEND API ACTIONS: App.tsx calls these methods. The server runs the actual workflow rules in backend/services.ts.
export function serviceClient(version: number) {
  const query = (params: Record<string, string> = {}) =>
    "?" + new URLSearchParams({ version: String(version), ...params });

  async function file<T extends { blob: Blob }>(
    kind: string,
    id: string,
  ): Promise<T> {
    const record = await request<FileResponse<T>>("/" + kind + query({ id }));
    const bytes = Uint8Array.from(atob(record.blob.bytes), (byte) =>
      byte.charCodeAt(0),
    );
    return {
      ...record,
      blob: new Blob([bytes], { type: record.blob.type }),
    } as T;
  }

  const files = {
    upload: (taskId: string, upload: File) =>
      request<void>("/uploads" + query({ taskId, name: upload.name }), {
        method: "POST",
        headers: { "Content-Type": upload.type },
        body: upload,
      }),
    document: (id: string) => file<DocumentRecord>("document", id),
    certificate: (id: string) => file<CompletionCertificate>("certificate", id),
  };
  return new Proxy(files as typeof files & RemoteServices, {
    get(target, name: string) {
      if (Object.hasOwn(target, name)) return Reflect.get(target, name);
      return (...args: unknown[]) =>
        post<void>("/actions/" + name + query(), args);
    },
  });
}
