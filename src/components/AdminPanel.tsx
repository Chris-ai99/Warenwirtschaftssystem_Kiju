import { AdminSystem } from "./AdminSystem";

type Kind =
  | "dashboard"
  | "artikel"
  | "lager"
  | "standorte"
  | "kategorien"
  | "verpackungseinheiten"
  | "benutzer"
  | "rollen-rechte"
  | "buchungsgruende"
  | "scanner"
  | "pfand-leergut"
  | "systemtexte"
  | "menues"
  | "import-export"
  | "protokolle"
  | "einstellungen";

export function AdminPanel({ kind }: { kind: Kind }) {
  return <AdminSystem section={kind} />;
}
