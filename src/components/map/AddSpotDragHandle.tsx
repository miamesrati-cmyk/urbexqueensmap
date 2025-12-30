type Props = {
  onActivate: () => void;
  active: boolean;
};

export default function AddSpotDragHandle({ onActivate, active }: Props) {
  return (
    <button
      type="button"
      className={`map-add-spot-handle ${active ? "is-active" : ""}`}
      onClick={onActivate}
      aria-pressed={active}
    >
      {active ? "Tap map to place" : "Ajouter un spot"}
    </button>
  );
}
