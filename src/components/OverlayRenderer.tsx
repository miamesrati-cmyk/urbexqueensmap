import type { ReactNode } from "react";
import type {
  DeviceType,
  MapStyleValue,
  OverlayComponent,
} from "../services/adminConfigs";

type OverlayRendererProps = {
  components: OverlayComponent[];
  role: string;
  device: DeviceType;
  viewportWidth: number;
  mapZoom: number;
  mapStyle: MapStyleValue;
  preview?: boolean;
};

const SLOTS: OverlayComponent["slot"][] = [
  "top",
  "left",
  "right",
  "bottomRight",
  "floating",
];

export default function OverlayRenderer({
  components,
  role,
  device,
  viewportWidth,
  mapZoom,
  mapStyle,
  preview = false,
}: OverlayRendererProps) {
  const normalizedRole = role || "guest";

  const visibleComponents = components.filter((component) =>
    shouldShowComponent(component, {
      role: normalizedRole,
      device,
      viewportWidth,
      mapZoom,
      mapStyle,
    })
  );

  const slots: Record<OverlayComponent["slot"], OverlayComponent[]> = {
    top: [],
    left: [],
    right: [],
    bottomRight: [],
    floating: [],
  };

  visibleComponents.forEach((component) => {
    slots[component.slot]?.push(component);
  });

  return (
    <div className="overlay-root">
      {SLOTS.map((slot) => (
        <div key={slot} className={`overlay-slot overlay-slot--${slot}`}>
          {slots[slot]
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .map((component) => (
              <div key={component.id} className="overlay-card">
                <strong>{component.label}</strong>
                {component.content && <p>{component.content}</p>}
                {preview && renderVisibility(component.visibility)}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

type OverlayFilter = {
  role: string;
  device: DeviceType;
  viewportWidth: number;
  mapZoom: number;
  mapStyle: MapStyleValue;
};

function shouldShowComponent(
  component: OverlayComponent,
  context: OverlayFilter
) {
  const visibility = component.visibility;
  if (!visibility) return true;
  if (
    visibility.roles &&
    visibility.roles.length > 0 &&
    !visibility.roles.includes(context.role)
  ) {
    return false;
  }
  if (
    visibility.devices &&
    visibility.devices.length > 0 &&
    !visibility.devices.includes(context.device)
  ) {
    return false;
  }
  if (
    visibility.minWidth != null &&
    context.viewportWidth < visibility.minWidth
  ) {
    return false;
  }
  if (
    visibility.maxWidth != null &&
    context.viewportWidth > visibility.maxWidth
  ) {
    return false;
  }
  if (visibility.minZoom != null && context.mapZoom < visibility.minZoom) {
    return false;
  }
  if (visibility.maxZoom != null && context.mapZoom > visibility.maxZoom) {
    return false;
  }
  if (
    visibility.mapStyles &&
    visibility.mapStyles.length > 0 &&
    !visibility.mapStyles.includes(context.mapStyle)
  ) {
    return false;
  }
  return true;
}

function renderVisibility(visibility?: OverlayComponent["visibility"]): ReactNode {
  if (!visibility) return null;
  const rows = [];
  if (visibility.roles && visibility.roles.length > 0) {
    rows.push(<span key="roles">Rôles: {visibility.roles.join(", ")}</span>);
  }
  if (visibility.devices && visibility.devices.length > 0) {
    rows.push(
      <span key="devices">Appareils: {visibility.devices.join(", ")}</span>
    );
  }
  if (visibility.mapStyles && visibility.mapStyles.length > 0) {
    rows.push(
      <span key="styles">Styles: {visibility.mapStyles.join(", ")}</span>
    );
  }
  if (
    visibility.minWidth != null ||
    visibility.maxWidth != null ||
    visibility.minZoom != null ||
    visibility.maxZoom != null
  ) {
    rows.push(
      <span key="ranges">
        {visibility.minWidth != null && `minW: ${visibility.minWidth}px `}
        {visibility.maxWidth != null && `maxW: ${visibility.maxWidth}px `}
        {visibility.minZoom != null && `minZ: ${visibility.minZoom} `}
        {visibility.maxZoom != null && `maxZ: ${visibility.maxZoom}`}
      </span>
    );
  }
  return <div className="overlay-card-meta">{rows}</div>;
}
