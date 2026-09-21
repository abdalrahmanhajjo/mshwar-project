export async function downloadDataExport(): Promise<void> {
  const response = await fetch("/api/v1/privacy/export", { credentials: "include" });
  if (!response.ok) {
    throw new Error("export");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "mshwar-data-export.json";
  link.click();
  URL.revokeObjectURL(url);
}

export async function resetPersonalisation(): Promise<void> {
  const response = await fetch("/api/v1/privacy/reset-personalisation", {
    method: "POST",
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("reset");
  }
}

export async function deleteAccount(confirmation: string): Promise<void> {
  const response = await fetch("/api/v1/privacy/delete-account", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmation }),
  });
  if (!response.ok) {
    throw new Error("delete");
  }
}
