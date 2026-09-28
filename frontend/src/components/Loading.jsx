import { useT } from "../i18n";

export default function Loading({ label }) {
  const { t } = useT();
  return (
    <div className="loading">
      <div className="spinner" aria-hidden="true" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}
