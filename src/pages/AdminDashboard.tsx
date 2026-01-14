import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type JSX,
} from "react";
import { PageContainer, SectionCard, UrbexButton } from "../components/ui/UrbexUI";
import { AdminLayout, type AdminPageKey } from "../components/admin/AdminLayout";
import Skeleton from "../components/Skeleton";
import AdminMapUIPage from "./AdminMapUIPage";
import ThemeEditorPage from "./admin/ThemeEditorPage";
import UiConfigPage from "./admin/UiConfigPage";
import OverlayStudioPage from "./admin/OverlayStudioPage";
import { listenPlaces, createPlace, type Place } from "../services/places";
import { useCurrentUserRole } from "../hooks/useCurrentUserRole";
import { useProStatus, type ProSource } from "../contexts/ProStatusContext";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  addCustomer,
  addProduct,
  createTestOrder,
  listenCustomers,
  listenIntegrations,
  listenOrders,
  listenProducts,
  setIntegrationEnabled,
  updateOrderStatus,
  updateProduct,
} from "../services/shop";
import { fetchIntegrationHealth } from "../services/integrationHealth";
import type {
  IntegrationSettings,
  ShopCustomer,
  ShopOrder,
  ShopOrderStatus,
  ShopProduct,
  ShopProductStatus,
} from "../types/shop";
import type { IntegrationHealthData } from "../types/integrationHealth";
import {
  listenSpotSubmissions,
  type SpotSubmission,
  type SpotSubmissionSource,
  type SpotSubmissionStatus,
  updateSpotSubmission,
} from "../services/spotSubmissions";
import { uploadProductImage } from "../services/storage";
import { httpsCallable } from "firebase/functions";
import {
  collection,
  
  orderBy,
  query,
  type DocumentData,
} from "firebase/firestore";
import { onSnapshot } from "../lib/firestoreHelpers";
import { db, functions as firebaseFunctions } from "../lib/firebase";
import {
  DEFAULT_ADMIN_UI_CONFIG,
  useAdminUiConfig,
} from "../hooks/useAdminUiConfig";
import { useToast } from "../contexts/useToast";
import type { AdminUiConfig } from "../hooks/useAdminUiConfig";
import {
  emitProDebugFlagChange,
  PRO_DEBUG_STORAGE_KEY,
  useProDebugFlag,
} from "../utils/debugFlags";

// Routes validées :
// - /admin : Tableau de bord admin
// - /admin/places : Lieux
// - /admin/spots-proposes : Spots proposés
// - /admin/place-history : Histoires des lieux
// - /admin/users : Utilisateurs
// - /admin/shop : Tableau de bord boutique
// - /admin/shop/products : Produits
// - /admin/shop/orders : Commandes
// - /admin/shop/customers : Clients
// - /admin/analytics : Statistiques
// - /admin/revenue : Revenus PRO
// - /admin/activity : Activité récente
// - /admin/settings : Paramètres admin
// KPIs (sources) :
// - Spots publics : `places` Firestore with `isPublic === true`, not drafted.
// - Spots PRO : `places` where `proOnly`/`isProOnly` is truthy and published.
// - Membres PRO actifs : `shopCustomers` documents with `isProMember === true`.
// - Produits merch : `shopProducts` (Printful sync or internal catalog).
// - Commandes merch : `shopOrders` ordered by `createdAt`.
// - Revenus estimés / mois : `Membres PRO actifs * 12.99 $` en attendant le MRR Stripe.

const PRO_MONTHLY_PRICE = 12.99;

const ORDER_STATUS_MAP: Record<string, string> = {
  pending: "pending",
  processing: "pending",
  shipped: "fulfilled",
  fulfilled: "fulfilled",
  cancelled: "cancelled",
  refunded: "refunded",
};
const normalizeOrderStatus = (status: string) => ORDER_STATUS_MAP[status] ?? status;
function formatOrderStatus(status: string) {
  const normalized = normalizeOrderStatus(status);
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}
function getOrderStatusVariant(status: string) {
  const normalized = normalizeOrderStatus(status);
  if (normalized === "fulfilled") return "pill-live";
  return "pill-muted";
}

const FIRESTORE_PLACE_CONSOLE_URL = import.meta.env.VITE_FIREBASE_PROJECT_ID
  ? `https://console.firebase.google.com/project/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/firestore/data/~2Fplaces`
  : null;

type KpiValues = {
  publicCount: number;
  proCount: number;
  proMembers: number;
  productsCount: number;
  ordersCount: number;
  revenueMonthly: number;
  revenueAnnual: number;
};

type ProDiagnosticsInfo = {
  isPro: boolean;
  loading: boolean;
  source: ProSource;
  proStatus: string;
  uid: string | null;
  plan: string | null;
  stripeCustomerId: string | null;
};

const KPI_DEFINITIONS: Record<keyof KpiValues, string> = {
  publicCount: "Comptage Firestore des spots publics vérifiés (isPublic=true, pas de draft).",
  proCount: "Spots marqués PRO ou réservés aux membres PRO (proOnly / isProOnly) et publiés.",
  proMembers: "Clients déclarés PRO (`shopCustomers` avec isProMember=true).",
  productsCount: "Produits merch synchro Printful ou catalogues internes (`shopProducts`).",
  ordersCount: "Commandes merch Firestore triées par `createdAt`.",
  revenueMonthly: "Estimation = PRO actifs × 12,99 $ / mois (à remplacer si MRR Stripe dispo).",
  revenueAnnual: "Projection annuelle basée sur le MRR estimé × 12.",
};

type Props = {
  initialPlaceId?: string | null;
  page?: AdminPageKey;
  selectedOrderId?: string | null;
};

type AdminUser = {
  uid: string;
  displayName: string | null;
  email: string | null;
  isPro: boolean;
  isAdmin: boolean;
  createdAt?: number;
};

type SubmissionFilter = SpotSubmissionStatus | "all";

export default function AdminDashboard({
  initialPlaceId = null,
  page = "dashboard",
  selectedOrderId = null,
}: Props) {
  const { user, isLoading, isAdmin, isPro } = useCurrentUserRole();
  const toast = useToast();
  const { config: adminUiConfig } = useAdminUiConfig();
  const moduleStates =
    adminUiConfig?.modules ?? DEFAULT_ADMIN_UI_CONFIG.modules;
  const proDebugEnabled = useProDebugFlag();
  const { profile, proLoading, proSource, proStatus } = useProStatus();
  const [places, setPlaces] = useState<Place[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [customers, setCustomers] = useState<ShopCustomer[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationSettings[]>([]);
  const [syncingPrintful, setSyncingPrintful] = useState(false);
  const [submissions, setSubmissions] = useState<SpotSubmission[]>([]);
  const [submissionFilter, setSubmissionFilter] = useState<SubmissionFilter>("pending");
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(null);
  
  // Options de modération pour les spots
  const [spotTier, setSpotTier] = useState<"STANDARD" | "EPIC" | "GHOST">("STANDARD");
  const [spotIsProOnly, setSpotIsProOnly] = useState(false);

  const [placeSearch, setPlaceSearch] = useState("");
  const [placeFilter, setPlaceFilter] = useState<"all" | "public" | "pro">("all");
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(initialPlaceId);
  const [orderDetailId, setOrderDetailId] = useState<string | null>(selectedOrderId);

  const [showProductModal, setShowProductModal] = useState(false);
  const [productDraft, setProductDraft] = useState<Partial<ShopProduct> | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showIntegrationModal, setShowIntegrationModal] = useState<IntegrationSettings["id"] | null>(null);
  const [placesLoading, setPlacesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [kpisError, setKpisError] = useState<string | null>(null);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const proDiagnostics = useMemo<ProDiagnosticsInfo>(() => {
    const uid = user?.uid ?? profile?.uid ?? null;
    return {
      isPro,
      loading: proLoading,
      source: proSource,
      proStatus: proStatus ?? "unknown",
      uid,
      plan: profile?.plan ?? null,
      stripeCustomerId: profile?.stripeCustomerId ?? null,
    };
  }, [
    isPro,
    proLoading,
    proSource,
    proStatus,
    user?.uid,
    profile?.uid,
    profile?.plan,
    profile?.stripeCustomerId,
  ]);
  const handleCopyDiagnostics = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      toast.error("Impossible d’accéder au presse-papiers.");
      return;
    }
    const payload = {
      ...proDiagnostics,
      debugMode: proDebugEnabled,
      copiedAt: new Date().toISOString(),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Diagnostics copiés");
    } catch (error) {
      console.error("Erreur copie diagnostics", error);
      toast.error("Impossible de copier les diagnostics pour le moment.");
    }
  }, [proDiagnostics, proDebugEnabled, toast]);
  const handleEnableProDebug = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(PRO_DEBUG_STORAGE_KEY, "1");
      emitProDebugFlagChange();
      toast.success("Debug PRO activé dans ce navigateur.");
    } catch (error) {
      console.error("Erreur activation debug PRO", error);
      toast.error("Impossible d’activer le debug PRO.");
    }
  }, [toast]);
  const handleDisableProDebug = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(PRO_DEBUG_STORAGE_KEY);
      emitProDebugFlagChange();
      toast.success("Debug PRO désactivé dans ce navigateur.");
    } catch (error) {
      console.error("Erreur désactivation debug PRO", error);
      toast.error("Impossible de désactiver le debug PRO.");
    }
  }, [toast]);

  const reportKpiError = useCallback((message: string, error?: unknown) => {
    if (import.meta.env.DEV) {
      console.error(message, error);
    }
    setKpisError(message);
  }, []);

  const retryKpis = useCallback(() => {
    setKpisError(null);
    setRefreshKey((value) => value + 1);
  }, []);

  const handlePlaceRetry = useCallback(() => {
    setPlacesError(null);
    setPlacesLoading(true);
    setRefreshKey((value) => value + 1);
  }, []);

  const navigateAdmin = useCallback((path: string) => {
    if (typeof window === "undefined") return;
    window.history.pushState({}, "", path);
    window.dispatchEvent(new CustomEvent("urbex-nav", { detail: { path } }));
  }, []);

  const handleSpotClick = useCallback(
    (spotId: string) => navigateAdmin(`/spot/${spotId}`),
    [navigateAdmin]
  );
  const handleUserClick = useCallback(
    (uid: string) => navigateAdmin(`/profile/${uid}`),
    [navigateAdmin]
  );
  const handleViewAllSpots = useCallback(() => navigateAdmin("/admin/places"), [navigateAdmin]);
  const handleViewSpotSubmissions = useCallback(
    () => navigateAdmin("/admin/spots-proposes"),
    [navigateAdmin]
  );
  const handleViewAllCustomers = useCallback(
    () => navigateAdmin("/admin/users"),
    [navigateAdmin]
  );
  const handleViewAllOrders = useCallback(
    () => navigateAdmin("/admin/shop/orders"),
    [navigateAdmin]
  );
  const handleViewHistory = useCallback(
    (placeId: string) => {
      setSelectedPlaceId(placeId);
      navigateAdmin(`/spot/${placeId}/edit-history`);
    },
    [navigateAdmin]
  );
  const handleViewAllProducts = useCallback(
    () => navigateAdmin("/admin/shop/products"),
    [navigateAdmin]
  );
  const handleOrderClick = useCallback(
    (orderId: string) => navigateAdmin(`/admin/shop/orders/${orderId}`),
    [navigateAdmin]
  );
  const handleConnectPrintful = useCallback(
    () => setShowIntegrationModal("printful"),
    [setShowIntegrationModal]
  );
  useEffect(() => {
    // Charger les places uniquement sur les pages qui en ont besoin
    const needsPlaces = ["dashboard", "places", "histories"].includes(page);
    if (!needsPlaces) {
      setPlaces([]);
      setPlacesLoading(false);
      return;
    }
    
    setPlacesLoading(true);
    setPlacesError(null);
    let ready = false;
    const unsub = listenPlaces(
      (all) => {
        setPlaces(all);
        setPlacesError(null);
        if (!ready) {
          ready = true;
          setPlacesLoading(false);
        }
      },
      { isPro: true },
      (error) => {
        setPlacesLoading(false);
        setPlacesError("Impossible de charger les lieux admin");
        reportKpiError("Impossible de charger les lieux admin", error);
      }
    );
    return () => unsub();
  }, [refreshKey, reportKpiError, page]);

  useEffect(() => {
    // Charger les produits uniquement sur les pages shop
    const needsProducts = ["dashboard", "shop", "products"].includes(page);
    if (!needsProducts) {
      setProducts([]);
      setProductsLoading(false);
      return;
    }
    
    setProductsLoading(true);
    let ready = false;
    const unsub = listenProducts(
      (items) => {
        setProducts(items);
        if (!ready) {
          ready = true;
          setProductsLoading(false);
        }
      },
      (error) => {
        setProductsLoading(false);
        reportKpiError("Impossible de récupérer les produits merch", error);
      }
    );
    return () => unsub();
  }, [refreshKey, reportKpiError, page]);

  useEffect(() => {
    // Charger les commandes uniquement sur les pages shop
    const needsOrders = ["dashboard", "shop", "orders"].includes(page);
    if (!needsOrders) {
      setOrders([]);
      setOrdersLoading(false);
      return;
    }
    
    setOrdersLoading(true);
    let ready = false;
    const unsub = listenOrders(
      (items) => {
        setOrders(items);
        if (!ready) {
          ready = true;
          setOrdersLoading(false);
        }
      },
      (error) => {
        setOrdersLoading(false);
        reportKpiError("Impossible de charger les commandes merch", error);
      }
    );
    return () => unsub();
  }, [refreshKey, reportKpiError, page]);

  useEffect(() => {
    // Charger les clients uniquement sur les pages dashboard, shop ou users
    const needsCustomers = ["dashboard", "shop", "customers", "users"].includes(page);
    if (!needsCustomers) {
      setCustomers([]);
      setCustomersLoading(false);
      return;
    }
    
    setCustomersLoading(true);
    let ready = false;
    const unsub = listenCustomers(
      (items) => {
        setCustomers(items);
        if (!ready) {
          ready = true;
          setCustomersLoading(false);
        }
      },
      (error) => {
        setCustomersLoading(false);
        reportKpiError("Impossible de récupérer les membres PRO", error);
      }
    );
    return () => unsub();
  }, [refreshKey, reportKpiError, page]);

  useEffect(() => {
    // Charger les intégrations uniquement sur les pages shop
    const needsIntegrations = ["dashboard", "shop", "products"].includes(page);
    if (!needsIntegrations) {
      setIntegrations([]);
      return;
    }
    
    let ready = false;
    const unsub = listenIntegrations(
      (items) => {
        setIntegrations(items);
        if (!ready) {
          ready = true;
        }
      },
      (error) => {
        reportKpiError("Impossible de charger les intégrations", error);
      }
    );
    return () => unsub();
  }, [refreshKey, reportKpiError, page]);

  useEffect(() => {
    // Ne lancer le listener que si on est sur la page des submissions
    if (page !== "spotSubmissions") {
      setSubmissions([]);
      return;
    }
    
    const statusOption: SpotSubmissionStatus | undefined =
      submissionFilter === "all" ? undefined : submissionFilter;
    const unsub = listenSpotSubmissions(
      (items) => {
        setSubmissions(items);
        setSelectedSubmissionId((prev) => {
          if (prev && items.some((item) => item.id === prev)) return prev;
          return items[0]?.id ?? null;
        });
      },
      statusOption ? { status: statusOption } : undefined
    );
    return () => unsub();
  }, [submissionFilter, page]);

  useEffect(() => {
    // Charger les utilisateurs uniquement sur la page users
    if (page !== "users") {
      setUsers([]);
      return;
    }
    
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items: AdminUser[] = snap.docs.map((doc) => {
        const data = doc.data() as DocumentData;
        return {
          uid: doc.id,
          displayName: data.displayName ?? null,
          email: data.email ?? null,
          isPro: !!data.isPro,
          isAdmin: !!data.isAdmin,
          createdAt: data.createdAt?.toMillis?.() ?? data.createdAt ?? undefined,
        };
      });
      setUsers(items);
    });
    return () => unsub();
  }, [page]);

  useEffect(() => {
    if (initialPlaceId) setSelectedPlaceId(initialPlaceId);
  }, [initialPlaceId]);

  useEffect(() => {
    if (selectedOrderId) setOrderDetailId(selectedOrderId);
  }, [selectedOrderId]);

  useEffect(() => {
    setRejectionReason("");
  }, [selectedSubmissionId]);

  const debouncedPlaceSearch = useDebouncedValue(placeSearch, 300);

  const filteredPlaces = useMemo(() => {
    const needle = debouncedPlaceSearch.trim().toLowerCase();
    return places.filter((place) => {
      const targetFields = [
        place.title,
        place.name,
        place.city,
        place.region,
      ]
        .filter(Boolean)
        .map((value) => value!.toLowerCase());
      const matchesSearch = needle
        ? targetFields.some((value) => value.includes(needle))
        : true;
      const matchesFilter =
        placeFilter === "all"
          ? true
          : placeFilter === "public"
          ? place.isPublic && !place.proOnly
          : place.proOnly || place.historyIsPro;
      return matchesSearch && matchesFilter;
    });
  }, [places, debouncedPlaceSearch, placeFilter]);

  const kpis = useMemo(() => {
    const publicCount = places.filter((p) => !p.isDraft && p.isPublic && !p.proOnly).length;
    const proCount = places.filter((p) => !p.isDraft && (p.proOnly || p.isProOnly)).length;
    const customersProMembers = customers.filter((u) => u.isProMember).length;
    const fallbackProMembers = users.filter((u) => u.isPro).length;
    const proMembers = customersProMembers || fallbackProMembers;
    const revenueMonthly = proMembers * PRO_MONTHLY_PRICE;
    const pendingSubmissions = submissions.filter((s) => s.status === "pending").length;
    return {
      publicCount,
      proCount,
      proMembers,
      revenueMonthly,
      revenueAnnual: revenueMonthly * 12,
      productsCount: products.length,
      ordersCount: orders.length,
      pendingSubmissions,
    };
  }, [places, customers, users, products.length, orders.length, submissions]);

  const kpisLoading =
    placesLoading || productsLoading || ordersLoading || customersLoading;

  const merchKpis = useMemo(() => {
    const activeProducts = products.filter((p) => p.status === "active").length;
    const draftProducts = products.filter((p) => p.status === "draft").length;
    const pendingOrders = orders.filter((o) => o.status === "pending" || o.status === "processing").length;
    const shippedOrders = orders.filter((o) => o.status === "shipped").length;
    const estMerchMonthly = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    return { activeProducts, draftProducts, pendingOrders, shippedOrders, estMerchMonthly };
  }, [orders, products]);

  const handleCenterMap = (submission: SpotSubmission) => {
    window.dispatchEvent(
      new CustomEvent("urbex-pan-to", {
        detail: { lat: submission.coordinates.lat, lng: submission.coordinates.lng, zoom: 14 },
      })
    );
  };

  async function handleApproveSubmission(submission: SpotSubmission) {
    setProcessingSubmissionId(submission.id);
    try {
      const isPublic = submission.isPublic ?? true;
      
      // Construire le payload en omettant les champs undefined (Firestore ne les accepte pas)
      const placePayload: any = {
        title: submission.title,
        description:
          submission.descriptionFull ??
          submission.descriptionShort ??
          submission.title ??
          "Spot urbex",
        category: submission.category ?? "autre",
        riskLevel: submission.riskLevel ?? "moyen",
        access: submission.access ?? "moyen",
        lat: submission.coordinates.lat,
        lng: submission.coordinates.lng,
        isPublic,
        isGhost: spotTier === "GHOST",
        isLegend: spotTier === "EPIC",
        isProOnly: spotIsProOnly || !isPublic,
        addedBy: user?.uid ?? "admin",
        createdBy: user?.uid ?? "admin",
        approved: true,
        proOnly: spotIsProOnly || !isPublic,
      };

      // Ajouter les champs optionnels seulement s'ils existent
      if (typeof submission.dangerIndex === "number") {
        placePayload.dangerIndex = submission.dangerIndex;
      }
      if (typeof submission.paranormalIndex === "number") {
        placePayload.paranormalIndex = submission.paranormalIndex;
      }
      if (submission.city) {
        placePayload.city = submission.city;
      }
      if (submission.region) {
        placePayload.region = submission.region;
      }
      if (submission.notesForAdmin) {
        placePayload.adminNotes = submission.notesForAdmin;
      }

      const newPlaceId = await createPlace(placePayload);
      await updateSpotSubmission(submission.id, {
        status: "approved",
        approvedSpotId: newPlaceId,
        rejectionReason: undefined,
      });

      toast.success(`Spot "${submission.title}" approuvé avec succès !`);
      // Reset tier and PRO-only flags after approval
      setSpotTier("STANDARD");
      setSpotIsProOnly(false);
    } catch (error) {
      console.error("Erreur approbation spot", error);
      toast.error("Impossible d’approuver ce spot pour l’instant.");
    } finally {
      setProcessingSubmissionId(null);
    }
  }

  async function handleRejectSubmission(submission: SpotSubmission) {
    setProcessingSubmissionId(submission.id);
    try {
      await updateSpotSubmission(submission.id, {
        status: "rejected",
        rejectionReason: rejectionReason.trim() || undefined,
      });
      setRejectionReason("");
    } catch (error) {
      console.error("Erreur rejet spot", error);
      toast.error("Impossible de refuser cette soumission pour le moment.");
    } finally {
      setProcessingSubmissionId(null);
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <SectionCard>
          <div className="panel-loading">
            <Skeleton className="panel-loading__line" />
            <Skeleton className="panel-loading__line" />
            <Skeleton className="panel-loading__line" />
          </div>
        </SectionCard>
      </PageContainer>
    );
  }

  if (!user || !isAdmin) {
    return (
      <PageContainer>
        <SectionCard>
          <h2>Accès refusé</h2>
          <p>Seuls les admins peuvent ouvrir ce panneau.</p>
        </SectionCard>
      </PageContainer>
    );
  }

  const pageMeta = getPageMeta(page, {
    openProductModal: () => {
      setProductDraft(null);
      setShowProductModal(true);
    },
  });

  async function handleSyncPrintful() {
    setSyncingPrintful(true);
    try {
      const callable = httpsCallable(
        firebaseFunctions,
        "syncPrintfulProducts"
      );
      await callable();
    } catch (err) {
      console.error("Sync Printful error", err);
      toast.error("Impossible de synchroniser Printful pour l’instant.");
    } finally {
      setSyncingPrintful(false);
    }
  }

  return (
    <AdminLayout
      current={page}
      title={pageMeta.title}
      subtitle={pageMeta.subtitle}
      actions={pageMeta.actions}
      moduleStates={moduleStates}
    >
      {page === "dashboard" && (
        <AdminOverview
          places={places}
          users={users}
          customers={customers}
          orders={orders}
          kpis={kpis}
          kpisLoading={kpisLoading}
          kpisError={kpisError}
          onRetryKpis={retryKpis}
          onSpotClick={handleSpotClick}
          onUserClick={handleUserClick}
          onOrderClick={handleOrderClick}
          onViewAllSpots={handleViewAllSpots}
          onViewAllCustomers={handleViewAllCustomers}
          onViewAllOrders={handleViewAllOrders}
          onViewSpotSubmissions={handleViewSpotSubmissions}
          proDiagnostics={proDiagnostics}
          proDebugEnabled={proDebugEnabled}
          onCopyDiagnostics={handleCopyDiagnostics}
          onEnableProDebug={handleEnableProDebug}
          onDisableProDebug={handleDisableProDebug}
        />
      )}
      {page === "shop" && (
        <AdminShopDashboardPage
          merchKpis={merchKpis}
          orders={orders}
          products={products}
          customers={customers}
          integrations={integrations}
          onOrderClick={handleOrderClick}
          onViewOrders={handleViewAllOrders}
          onViewProducts={handleViewAllProducts}
          onViewCustomers={handleViewAllCustomers}
          onConnectPrintful={handleConnectPrintful}
        />
      )}
      {page === "places" && (
        <AdminPlacesPage
          places={filteredPlaces}
          searchValue={placeSearch}
          onSearchChange={setPlaceSearch}
          filter={placeFilter}
          onFilterChange={setPlaceFilter}
          selectedPlaceId={selectedPlaceId}
          onSelectPlace={setSelectedPlaceId}
          loading={placesLoading}
          error={placesError}
          onRetry={handlePlaceRetry}
          onViewHistory={handleViewHistory}
        />
      )}
      {page === "spotSubmissions" && (
        <AdminSpotSubmissionsPage
          submissions={submissions}
          filter={submissionFilter}
          onFilterChange={setSubmissionFilter}
          selectedSubmissionId={selectedSubmissionId}
          onSelectSubmission={setSelectedSubmissionId}
          onApprove={handleApproveSubmission}
          onReject={handleRejectSubmission}
          rejectionReason={rejectionReason}
          onReasonChange={setRejectionReason}
          processingId={processingSubmissionId}
          onCenterMap={handleCenterMap}
          spotTier={spotTier}
          onSpotTierChange={setSpotTier}
          spotIsProOnly={spotIsProOnly}
          onSpotIsProOnlyChange={setSpotIsProOnly}
        />
      )}
      {page === "histories" && <AdminHistoriesPage places={places} />}
      {page === "users" && <AdminUsersPage users={users} />}
      {page === "products" && (
        <AdminProductsPage
          products={products}
          onAdd={() => {
            setProductDraft(null);
            setShowProductModal(true);
          }}
          onEdit={(p) => {
            setProductDraft(p);
            setShowProductModal(true);
          }}
        />
      )}
      {page === "orders" && (
        <AdminOrdersPage
          orders={orders}
          customers={customers}
          onCreateTest={createTestOrder}
          selectedOrderId={orderDetailId}
          onSelectOrder={setOrderDetailId}
          onStatusChange={updateOrderStatus}
        />
      )}
      {page === "customers" && (
        <AdminCustomersPage customers={customers} onAdd={() => setShowCustomerModal(true)} />
      )}
      {page === "stats" && <AdminStatsPage kpis={kpis} />}
      {page === "revenue" && <AdminRevenuePage kpis={kpis} customers={customers} />}
      {page === "activity" && (
        <AdminActivityPage places={places} customers={customers} orders={orders} />
      )}
      {page === "mapUI" && <AdminMapUIPage />}
      {page === "themes" && <ThemeEditorPage />}
      {page === "uiConfig" && (
        <>
          <AdminConfigTokensCard />
          <UiConfigPage />
        </>
      )}
      {page === "overlays" && <OverlayStudioPage />}
      {page === "settings" && <AdminSettingsPage />}
      {page === "integrations" && (
        <AdminIntegrationsPage
          integrations={integrations}
          onToggle={(id, enabled) => setIntegrationEnabled(id, enabled)}
          onOpenModal={setShowIntegrationModal}
          onSyncPrintful={handleSyncPrintful}
          syncingPrintful={syncingPrintful}
        />
      )}

      {showProductModal && (
        <ProductModal
          initial={productDraft}
          onClose={() => setShowProductModal(false)}
          onSave={async (data) => {
            if (productDraft?.id) {
              await updateProduct(productDraft.id, data);
            } else {
              await addProduct(data as any);
            }
            setShowProductModal(false);
          }}
        />
      )}

      {showCustomerModal && (
        <CustomerModal
          onClose={() => setShowCustomerModal(false)}
          onSave={async (data) => {
            await addCustomer(data);
            setShowCustomerModal(false);
          }}
        />
      )}

      {showIntegrationModal && (
        <IntegrationModal
          id={showIntegrationModal}
          onClose={() => setShowIntegrationModal(null)}
          onConfirm={async (enabled) => {
            await setIntegrationEnabled(showIntegrationModal, enabled);
            setShowIntegrationModal(null);
          }}
        />
      )}
    </AdminLayout>
  );
}

function getPageMeta(
  page: AdminPageKey,
  actions?: { openProductModal: () => void }
) {
  const base = {
    title: "Tableau de bord admin",
    subtitle: "Vue globale de l’activité UrbexQueens",
    actions: null as null | ((ctx: any) => JSX.Element),
  };
  const map: Partial<Record<AdminPageKey, typeof base>> = {
    places: {
      title: "Gestion des lieux",
      subtitle: "Filtre, cherche et modifie les lieux urbex.",
      actions: null,
    },
    spotSubmissions: {
      title: "Spots proposés",
      subtitle: "Valide ou refuse les contributions avant mise en ligne.",
      actions: null,
    },
    histories: {
      title: "Histoires des lieux",
      subtitle: "Édite les récits et médias des spots.",
      actions: null,
    },
    users: {
      title: "Utilisateurs",
      subtitle: "Membres, PRO et activités récentes.",
      actions: null,
    },
    shop: {
      title: "Tableau de bord Boutique",
      subtitle: "Vue d’ensemble merch, prête pour Printful.",
      actions: ({ openProductModal }) => (
        <UrbexButton variant="primary" onClick={openProductModal}>
          + Ajouter un produit
        </UrbexButton>
      ),
    },
    products: {
      title: "Produits (merch)",
      subtitle: "Catalogue prêt pour l’intégration Printful.",
      actions: ({ openProductModal }) => (
        <UrbexButton variant="primary" onClick={openProductModal}>
          + Ajouter un produit
        </UrbexButton>
      ),
    },
    orders: {
      title: "Commandes",
      subtitle: "Suivi des commandes merch.",
      actions: null,
    },
    customers: {
      title: "Clients",
      subtitle: "Clients merch et membres PRO.",
      actions: null,
    },
    stats: {
      title: "Statistiques",
      subtitle: "Vue analytique et revenus PRO.",
      actions: null,
    },
    revenue: {
      title: "Revenus PRO",
      subtitle: "MRR, ARR et conversion PRO.",
      actions: null,
    },
    activity: {
      title: "Activité récente",
      subtitle: "Timeline des derniers évènements.",
      actions: null,
    },
    settings: {
      title: "Paramètres admin",
      subtitle: "Règles globales et préférences back-office.",
      actions: null,
    },
    mapUI: {
      title: "Map UI",
      subtitle: "Activez le mode édition pour la carte principale.",
      actions: null,
    },
    themes: {
      title: "Thèmes & tokens",
      subtitle: "Design tokens, presets et publication des thèmes.",
      actions: null,
    },
    uiConfig: {
      title: "Config UI",
      subtitle: "Flux brouillon/publication et rollback des réglages.",
      actions: null,
    },
    overlays: {
      title: "Overlay Studio",
      subtitle: "Slots, visibilité par rôle/appareil et aperçu.",
      actions: null,
    },
    integrations: {
      title: "Intégrations",
      subtitle: "Prépare Printful, Stripe et webhooks.",
      actions: null,
    },
  };
  const meta = map[page] ?? base;
  const resolvedActions =
    typeof meta.actions === "function" ? meta.actions(actions ?? {}) : meta.actions;
  return {
    ...meta,
    actions: resolvedActions,
  };
}

function AdminOverview({
  places,
  users,
  customers,
  orders,
  kpis,
  kpisLoading,
  kpisError,
  onRetryKpis,
  onSpotClick,
  onUserClick,
  onOrderClick,
  onViewAllSpots,
  onViewAllCustomers,
  onViewAllOrders,
  onViewSpotSubmissions,
  proDiagnostics,
  proDebugEnabled,
  onCopyDiagnostics,
  onEnableProDebug,
  onDisableProDebug,
}: {
  places: Place[];
  customers: ShopCustomer[];
  orders: ShopOrder[];
  // submissions supprimé - pas utilisé directement (les KPI contiennent pendingSubmissions)
  kpis: { 
    publicCount: number; 
    proCount: number; 
    proMembers: number; 
    revenueMonthly: number; 
    revenueAnnual: number; 
    productsCount: number; 
    ordersCount: number;
    pendingSubmissions: number;
  };
  users: AdminUser[];
  kpisLoading: boolean;
  kpisError: string | null;
  onRetryKpis: () => void;
  onSpotClick: (spotId: string) => void;
  onUserClick: (uid: string) => void;
  onOrderClick: (orderId: string) => void;
  onViewAllSpots: () => void;
  onViewAllCustomers: () => void;
  onViewAllOrders: () => void;
  onViewSpotSubmissions: () => void;
  proDiagnostics: ProDiagnosticsInfo;
  proDebugEnabled: boolean;
  onCopyDiagnostics: () => void;
  onEnableProDebug: () => void;
  onDisableProDebug: () => void;
}) {
  const latestPlaces = [...places]
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, 3);
  const latestUsers = [...users]
    .sort(
      (a, b) =>
        (b.createdAt ?? 0) - (a.createdAt ?? 0)
    )
    .slice(0, 3);
  const diagnosticEntries = [
    { label: "PRO", value: String(proDiagnostics.isPro) },
    { label: "loading", value: String(proDiagnostics.loading) },
    { label: "source", value: proDiagnostics.source },
    { label: "proStatus", value: proDiagnostics.proStatus },
    { label: "uid", value: proDiagnostics.uid ?? "—" },
  ];
  if (proDiagnostics.plan) {
    diagnosticEntries.push({ label: "plan", value: proDiagnostics.plan });
  }
  if (proDiagnostics.stripeCustomerId) {
    diagnosticEntries.push({
      label: "stripeCustomerId",
      value: proDiagnostics.stripeCustomerId,
    });
  }
  const latestOrders = [...orders]
    .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))
    .slice(0, 3);

  const renderKpis = () => {
    if (kpisLoading) {
      return (
        <div className="admin-kpi-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <KpiCardSkeleton key={index} />
          ))}
        </div>
      );
    }
    if (kpisError) {
      return (
        <div className="admin-kpi-error">
          <p>{kpisError}</p>
          <button type="button" className="admin-link-btn" onClick={onRetryKpis}>
            Réessayer
          </button>
        </div>
      );
    }
    return (
      <div className="admin-kpi-grid">
        <KpiCard
          label="Spots publics"
          value={kpis.publicCount}
          badge="Live"
          info={KPI_DEFINITIONS.publicCount}
        />
        <KpiCard
          label="Spots PRO"
          value={kpis.proCount}
          badge="PRO"
          accent
          info={KPI_DEFINITIONS.proCount}
        />
        <KpiCard
          label="En attente validation"
          value={kpis.pendingSubmissions}
          badge={kpis.pendingSubmissions > 0 ? "Action requise" : undefined}
          accent={kpis.pendingSubmissions > 0}
          info="Nombre de spots soumis par la communauté en attente d'approbation par un admin"
          onClick={kpis.pendingSubmissions > 0 ? onViewSpotSubmissions : undefined}
        />
        <KpiCard
          label="Membres PRO actifs"
          value={kpis.proMembers}
          info={KPI_DEFINITIONS.proMembers}
        />
        <KpiCard
          label="Produits merch"
          value={kpis.productsCount}
          info={KPI_DEFINITIONS.productsCount}
        />
        <KpiCard
          label="Commandes merch"
          value={kpis.ordersCount}
          info={KPI_DEFINITIONS.ordersCount}
        />
        <KpiCard
          label="Revenus estimés / mois"
          value={`${kpis.revenueMonthly.toFixed(2)} $`}
          info={KPI_DEFINITIONS.revenueMonthly}
        />
      </div>
    );
  };

  const getSpotStatus = (place: Place) => {
    if (place.isDraft) return { label: "Draft", variant: "pill-muted" };
    if (!place.isPublic) return { label: "Pending", variant: "pill-muted" };
    if (place.proOnly || place.isProOnly) return { label: "PRO", variant: "pill-pro" };
    return { label: "Public", variant: "pill-live" };
  };

  const getUserStatus = (user: AdminUser, customerLookup: Map<string, ShopCustomer>) => {
    if (user.isAdmin) return { label: "Admin", variant: "pill-live" };
    const customer = customerLookup.get(user.uid);
    if (customer?.isProMember) return { label: "PRO actif", variant: "pill-pro" };
    if (user.isPro) return { label: "PRO expiré", variant: "pill-muted" };
    return { label: "Membre", variant: "pill-live" };
  };

  const customerLookup = new Map<string, ShopCustomer>();
  customers.forEach((customer) => customerLookup.set(customer.id, customer));


  const formatDate = (value?: number) =>
    value
      ? new Date(value).toLocaleDateString("fr-CA", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "—";

  return (
    <>
      {renderKpis()}

      <SectionCard className="admin-diagnostics-card">
        <div className="admin-section-head admin-section-head--split">
          <div>
            <p className="admin-eyebrow">Diagnostics</p>
            <h3>PRO & debug</h3>
          </div>
          <div className="admin-diagnostics-status">
            <span
              className={`admin-pill admin-pill--compact ${
                proDebugEnabled ? "pill-pro" : "pill-muted"
              }`}
            >
              Debug PRO {proDebugEnabled ? "activé" : "désactivé"}
            </span>
          </div>
        </div>
        <div className="admin-diagnostics-grid">
          {diagnosticEntries.map((entry) => (
            <div key={entry.label} className="admin-diagnostics-cell">
              <span className="admin-diagnostics-label">{entry.label}</span>
              <span className="admin-diagnostics-value">{entry.value}</span>
            </div>
          ))}
        </div>
        {import.meta.env.DEV && (
          <div className="admin-diagnostics-actions">
            <UrbexButton variant="primary" onClick={onCopyDiagnostics}>
              Copier diagnostics
            </UrbexButton>
            <UrbexButton variant="secondary" onClick={onEnableProDebug}>
              Activer debug PRO (dev)
            </UrbexButton>
            <UrbexButton variant="secondary" onClick={onDisableProDebug}>
              Désactiver debug PRO
            </UrbexButton>
          </div>
        )}
      </SectionCard>

      <div className="admin-grid-2">
        <SectionCard>
          <div className="admin-section-head admin-section-head--split">
            <div>
              <p className="admin-eyebrow">Derniers spots</p>
              <h3>Derniers spots ajoutés</h3>
            </div>
            <button type="button" className="admin-link-btn" onClick={onViewAllSpots}>
              Voir tout
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head">
              <span>Nom</span>
              <span>Ville</span>
              <span>Statut</span>
              <span>Date</span>
            </div>
            {latestPlaces.length > 0 ? (
              latestPlaces.map((p) => {
                const status = getSpotStatus(p);
                return (
                  <div
                    key={p.id}
                    className="admin-table-row admin-table-row--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onSpotClick(p.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSpotClick(p.id);
                      }
                    }}
                  >
                    <span>{p.title || p.name}</span>
                    <span>{p.city || "—"}</span>
                    <span className={`admin-pill admin-pill--compact ${status.variant}`}>
                      {status.label}
                    </span>
                    <span>{formatDate(p.createdAt)}</span>
                  </div>
                );
              })
            ) : (
              <div className="admin-empty-state">
                <p>Aucun spot pour le moment.</p>
                <button type="button" className="admin-link-btn" onClick={onViewAllSpots}>
                  Voir tout
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard>
          <div className="admin-section-head admin-section-head--split">
            <div>
              <p className="admin-eyebrow">Derniers comptes</p>
              <h3>Derniers clients / membres</h3>
            </div>
            <button type="button" className="admin-link-btn" onClick={onViewAllCustomers}>
              Voir tout
            </button>
          </div>
          <div className="admin-table">
            <div className="admin-table-head">
              <span>Nom</span>
              <span>Email</span>
              <span>Statut</span>
              <span>Inscription</span>
            </div>
            {latestUsers.length > 0 ? (
              latestUsers.map((u) => {
                const status = getUserStatus(u, customerLookup);
                return (
                  <div
                    key={u.uid}
                    className="admin-table-row admin-table-row--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onUserClick(u.uid)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onUserClick(u.uid);
                      }
                    }}
                  >
                    <span>{u.displayName || "Profil sans nom"}</span>
                    <span>{u.email || "—"}</span>
                    <span className={`admin-pill admin-pill--compact ${status.variant}`}>
                      {status.label}
                    </span>
                    <span>{formatDate(u.createdAt)}</span>
                  </div>
                );
              })
            ) : (
              <div className="admin-empty-state">
                <p>Aucun client récent.</p>
                <button type="button" className="admin-link-btn" onClick={onViewAllCustomers}>
                  Voir tout
                </button>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="admin-section-head admin-section-head--split">
          <div>
            <p className="admin-eyebrow">Boutique</p>
            <h3>Dernières commandes merch</h3>
          </div>
          <button type="button" className="admin-link-btn" onClick={onViewAllOrders}>
            Voir tout
          </button>
        </div>
        <div className="admin-table">
          <div className="admin-table-head">
            <span>#Commande</span>
            <span>Date</span>
            <span>Client</span>
            <span>Montant</span>
            <span>Statut</span>
          </div>
          {latestOrders.length > 0 ? (
            latestOrders.map((o) => (
              <div
                key={o.id}
                className="admin-table-row admin-table-row--clickable"
                role="button"
                tabIndex={0}
                onClick={() => onOrderClick(o.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOrderClick(o.id);
                  }
                }}
              >
                <span>{o.id}</span>
                <span>{o.createdAt ? o.createdAt.toLocaleDateString("fr-CA") : "—"}</span>
                <span>{o.customerId}</span>
                <span>{o.totalAmount.toFixed(2)} $</span>
                <span
                  className={`admin-pill admin-pill--compact ${getOrderStatusVariant(o.status)}`}
                >
                  {formatOrderStatus(o.status)}
                </span>
              </div>
            ))
          ) : (
            <div className="admin-empty-state">
              <p>Aucune commande.</p>
              <button type="button" className="admin-link-btn" onClick={onViewAllOrders}>
                Voir tout
              </button>
            </div>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function AdminShopDashboardPage({
  merchKpis,
  orders,
  products,
  customers,
  integrations,
  onOrderClick,
  onViewOrders,
  onViewProducts,
  onViewCustomers,
  onConnectPrintful,
}: {
  merchKpis: { activeProducts: number; draftProducts: number; pendingOrders: number; shippedOrders: number; estMerchMonthly: number };
  orders: ShopOrder[];
  products: ShopProduct[];
  customers: ShopCustomer[];
  integrations: IntegrationSettings[];
  onOrderClick: (orderId: string) => void;
  onViewOrders: () => void;
  onViewProducts: () => void;
  onViewCustomers: () => void;
  onConnectPrintful: () => void;
}) {
  const printful = integrations.find((i) => i.id === "printful");
  const printfulConnected = !!printful?.enabled;
  const latestOrders = [...orders]
    .sort((a, b) => (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0))
    .slice(0, 5);
  const featuredProducts = products.slice(0, 3);
  const proClients = customers.filter((c) => c.isProMember).length;

  return (
    <>
      <div className="admin-kpi-grid admin-kpi-grid--wide">
        <KpiCard label="Produits actifs" value={merchKpis.activeProducts} accent />
        <KpiCard label="Brouillons" value={merchKpis.draftProducts} />
        <KpiCard label="Commandes en cours" value={merchKpis.pendingOrders} />
        <KpiCard label="Expédiées" value={merchKpis.shippedOrders} />
        <KpiCard label="Revenu merch estimé / mois" value={`${merchKpis.estMerchMonthly.toFixed(2)} $`} />
      </div>

      <div className="admin-grid-2">
        <SectionCard>
          <div className="admin-section-head admin-section-head--split">
            <div>
              <p className="admin-eyebrow">Commandes</p>
              <h3>Dernières commandes merch</h3>
              {!printfulConnected && (
                <p className="admin-header-sub">Printful n’est pas connecté. Active la synchronisation pour voir les commandes réelles.</p>
              )}
            </div>
            <button type="button" className="admin-link-btn" onClick={onViewOrders}>
              Voir tout
            </button>
          </div>
          {printfulConnected ? (
            <div className="admin-table">
              <div className="admin-table-head">
                <span>#Commande</span>
                <span>Date</span>
                <span>Client</span>
                <span>Montant</span>
                <span>Statut</span>
              </div>
              {latestOrders.length > 0 ? (
                latestOrders.map((o) => (
                  <div
                    key={o.id}
                    className="admin-table-row admin-table-row--clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => onOrderClick(o.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOrderClick(o.id);
                      }
                    }}
                  >
                    <span className="admin-strong">{o.id}</span>
                    <span>{o.createdAt ? o.createdAt.toLocaleDateString("fr-CA") : "—"}</span>
                    <span>{o.customerId}</span>
                    <span>{o.totalAmount.toFixed(2)} $</span>
                    <span className={`admin-pill admin-pill--compact ${getOrderStatusVariant(o.status)}`}>
                      {formatOrderStatus(o.status)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="admin-empty-state">
                  <p>Aucune commande.</p>
                  <button type="button" className="admin-link-btn" onClick={onViewOrders}>
                    Voir tout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="admin-empty-state">
              <p>Printful bientôt · connecte l’intégration pour synchroniser produits et commandes.</p>
              <button type="button" className="admin-link-btn" onClick={onConnectPrintful}>
                Connecter Printful
              </button>
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <div className="admin-section-head admin-section-head--split">
            <div>
              <p className="admin-eyebrow">Catalogue</p>
              <h3>Produits à la une</h3>
              <p className="admin-header-sub">Alignés sur l’esthétique UrbexQueens.</p>
            </div>
            <button type="button" className="admin-link-btn" onClick={onViewProducts}>
              Voir tout
            </button>
          </div>
          <div className="admin-shop-list">
            {featuredProducts.length > 0 ? (
              featuredProducts.map((p) => (
                <div key={p.id} className="admin-shop-row">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt={p.name} className="admin-thumb" />
                  ) : (
                    <div className="story-media-placeholder admin-thumb" />
                  )}
                  <div className="admin-shop-row-text">
                    <strong>{p.name}</strong>
                    <span className="admin-muted">
                      {p.category || "—"} · {p.price.toFixed(2)} CAD
                    </span>
                  </div>
                  <span className={`admin-pill ${p.status === "active" ? "pill-live" : "pill-muted"}`}>
                    {p.status === "active" ? "Actif" : "Brouillon"}
                  </span>
                </div>
              ))
            ) : (
              <div className="admin-empty-state">
                <p>Aucun produit.</p>
                <button type="button" className="admin-link-btn" onClick={onViewProducts}>
                  Voir tout
                </button>
              </div>
            )}
          </div>
          <div className="admin-shop-footer">
            <p className="admin-header-sub">Clients PRO actifs : {proClients}</p>
            <button type="button" className="admin-link-btn" onClick={onViewCustomers}>
              Voir clients
            </button>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

function AdminRevenuePage({
  kpis,
  customers,
}: {
  kpis: { publicCount: number; proCount: number; proMembers: number; revenueMonthly: number; revenueAnnual: number; productsCount: number; ordersCount: number };
  customers: ShopCustomer[];
}) {
  const proRate = customers.length > 0 ? (customers.filter((c) => c.isProMember).length / customers.length) * 100 : 0;
  const avgRevenue = kpis.proMembers > 0 ? kpis.revenueMonthly / kpis.proMembers : 0;
  return (
    <div className="admin-grid-2">
      <SectionCard>
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Revenus</p>
            <h3>Revenus PRO</h3>
            <p className="admin-header-sub">MRR basé sur les membres PRO actifs.</p>
          </div>
        </div>
        <div className="admin-kpi-grid">
          <KpiCard label="MRR PRO" value={`${kpis.revenueMonthly.toFixed(2)} $`} accent />
          <KpiCard label="ARR projeté" value={`${kpis.revenueAnnual.toFixed(0)} $`} />
          <KpiCard label="Membres PRO" value={kpis.proMembers} />
          <KpiCard label="Taux PRO" value={`${proRate.toFixed(1)} %`} />
          <KpiCard label="Revenu moyen / PRO" value={`${avgRevenue.toFixed(2)} $`} />
        </div>
      </SectionCard>
      <SectionCard>
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Forecast</p>
            <h3>Projection rapide</h3>
            <p className="admin-header-sub">Placeholders à affiner avec la data Stripe.</p>
          </div>
        </div>
        <div className="admin-forecast">
          <div className="admin-forecast-bar">
            <div className="admin-forecast-fill" style={{ width: `${Math.min(100, proRate)}%` }} />
          </div>
          <p className="admin-muted">
            Objectif : dépasser 500 PRO. Chaque +50 PRO ajoute ~{(50 * 12.99).toFixed(0)} $ / mois.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

function AdminActivityPage({
  places,
  customers,
  orders,
}: {
  places: Place[];
  customers: ShopCustomer[];
  orders: ShopOrder[];
}) {
  const events = [
    ...places
      .filter((p) => p.createdAt)
      .map((p) => ({
        date: p.createdAt as number,
        label: `Nouveau spot • ${p.title || p.name}`,
        badge: p.proOnly ? "PRO" : "Public",
      })),
    ...customers
      .filter((u) => u.createdAt)
      .map((u) => ({
        date: u.createdAt.getTime?.() ?? 0,
        label: `Inscription • ${u.displayName || "Profil sans nom"}`,
        badge: u.isProMember ? "PRO" : "Membre",
      })),
    ...orders.map((o) => ({
      date: o.createdAt?.getTime?.() ?? 0,
      label: `Commande merch ${o.id} • ${o.customerId}`,
      badge: o.status,
    })),
  ]
    .filter((e) => e.date)
    .sort((a, b) => (b.date as number) - (a.date as number))
    .slice(0, 10);

  return (
    <SectionCard>
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Activité</p>
          <h3>Activité récente</h3>
          <p className="admin-header-sub">Timeline croisée (spots, clients, merch).</p>
        </div>
      </div>
      <div className="admin-activity-feed">
        {events.map((event, idx) => (
          <div key={`${event.label}-${idx}`} className="admin-activity-item">
            <div className="admin-activity-dot" />
            <div className="admin-activity-body">
              <div className="admin-activity-title">{event.label}</div>
              <div className="admin-activity-meta">
                <span>
                  {new Date(event.date).toLocaleDateString("fr-CA", {
                    day: "2-digit",
                    month: "short",
                  })}
                </span>
                <span className="admin-pill pill-muted">{event.badge}</span>
              </div>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="admin-empty-text">Rien à signaler pour l’instant.</p>}
      </div>
    </SectionCard>
  );
}

function formatPlaceDate(value?: number) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("fr-CA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getPlaceRowStatus(place: Place) {
  if (place.isDraft) {
    return { label: "Draft", variant: "pill-muted" };
  }
  if (!place.isPublic) {
    return { label: "Pending", variant: "pill-muted" };
  }
  const isProStory = place.historyIsPro ?? false;
  if (isProStory || place.proOnly || place.isProOnly) {
    return { label: "PRO", variant: "pill-pro" };
  }
  return { label: "Public", variant: "pill-live" };
}

type PlaceFilterOption = "all" | "public" | "pro";

function AdminPlacesPage({
  places,
  searchValue,
  onSearchChange,
  filter,
  onFilterChange,
  selectedPlaceId,
  onSelectPlace,
  loading,
  error,
  onRetry,
  onViewHistory,
}: {
  places: Place[];
  searchValue: string;
  onSearchChange: (v: string) => void;
  filter: PlaceFilterOption;
  onFilterChange: (v: PlaceFilterOption) => void;
  selectedPlaceId: string | null;
  onSelectPlace: (id: string) => void;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewHistory: (id: string) => void;
}) {
  const showEmptyState = !loading && !error && places.length === 0;

  const handleCreatePlace = () => {
    if (!FIRESTORE_PLACE_CONSOLE_URL) return;
    if (typeof window !== "undefined") {
      window.open(FIRESTORE_PLACE_CONSOLE_URL, "_blank");
    }
  };

  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-filters">
        <input
          type="search"
          placeholder="Rechercher un lieu..."
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          disabled={loading}
        />
        <div className="admin-filter-buttons">
          <button
            type="button"
            aria-pressed={filter === "all"}
            className={`admin-filter-btn ${filter === "all" ? "is-active" : ""}`}
            onClick={() => onFilterChange("all")}
          >
            Tous
          </button>
          <button
            type="button"
            aria-pressed={filter === "public"}
            className={`admin-filter-btn ${filter === "public" ? "is-active" : ""}`}
            onClick={() => onFilterChange("public")}
          >
            Public
          </button>
          <button
            type="button"
            aria-pressed={filter === "pro"}
            className={`admin-filter-btn ${filter === "pro" ? "is-active" : ""}`}
            onClick={() => onFilterChange("pro")}
          >
            PRO
          </button>
        </div>
      </div>
      <div className="admin-table admin-table--places">
        <div className="admin-table-head">
          <span>Nom du lieu</span>
          <span>Ville</span>
          <span>Type</span>
          <span>Statut</span>
          <span>Date</span>
          <span>Action</span>
        </div>
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="admin-table-row admin-table-row--skeleton">
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
              <span className="admin-table-cell-skeleton uq-skeleton-line" />
            </div>
          ))}
        {!loading &&
          places.map((place) => {
            const status = getPlaceRowStatus(place);
            const displayDate =
              place.historyUpdatedAt ??
              place.updatedAt ??
              place.createdAt ??
              undefined;
            return (
              <div
                key={place.id}
                className={`admin-table-row admin-table-row--clickable ${
                  selectedPlaceId === place.id ? "is-selected" : ""
                }`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelectPlace(place.id);
                  onViewHistory(place.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectPlace(place.id);
                    onViewHistory(place.id);
                  }
                }}
              >
                <span>{place.title || place.name || "—"}</span>
                <span>{place.city || place.region || "—"}</span>
                <span>{place.category || "—"}</span>
                <span className={`admin-pill ${status.variant}`}>{status.label}</span>
                <span>{formatPlaceDate(displayDate)}</span>
                <span>
                  <button
                    className="admin-link-btn"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectPlace(place.id);
                      onViewHistory(place.id);
                    }}
                  >
                    Voir l’histoire
                  </button>
                </span>
              </div>
            );
          })}
        {showEmptyState && (
          <div className="admin-empty-state">
            <p>Aucun lieu trouvé.</p>
            {FIRESTORE_PLACE_CONSOLE_URL && (
              <UrbexButton variant="secondary" onClick={handleCreatePlace}>
                Créer / Importer un lieu
              </UrbexButton>
            )}
          </div>
        )}
      </div>
      {error && (
        <div className="admin-table-error">
          <p>{error}</p>
          <UrbexButton variant="secondary" onClick={onRetry}>
            Réessayer
          </UrbexButton>
        </div>
      )}
    </SectionCard>
  );
}

function AdminSpotSubmissionsPage({
  submissions,
  filter,
  onFilterChange,
  selectedSubmissionId,
  onSelectSubmission,
  onApprove,
  onReject,
  rejectionReason,
  onReasonChange,
  processingId,
  onCenterMap,
  spotTier,
  onSpotTierChange,
  spotIsProOnly,
  onSpotIsProOnlyChange,
}: {
  submissions: SpotSubmission[];
  filter: SubmissionFilter;
  onFilterChange: (value: SubmissionFilter) => void;
  selectedSubmissionId: string | null;
  onSelectSubmission: (id: string) => void;
  onApprove: (submission: SpotSubmission) => Promise<void>;
  onReject: (submission: SpotSubmission) => Promise<void>;
  rejectionReason: string;
  onReasonChange: (value: string) => void;
  processingId: string | null;
  onCenterMap: (submission: SpotSubmission) => void;
  spotTier: "STANDARD" | "EPIC" | "GHOST";
  onSpotTierChange: (tier: "STANDARD" | "EPIC" | "GHOST") => void;
  spotIsProOnly: boolean;
  onSpotIsProOnlyChange: (value: boolean) => void;
}) {
  const filters: { value: SubmissionFilter; label: string }[] = [
    { value: "pending", label: "En attente" },
    { value: "approved", label: "Approuvés" },
    { value: "rejected", label: "Refusés" },
    { value: "all", label: "Tous" },
  ];

  const SOURCE_LABELS: Record<SpotSubmissionSource, string> = {
    guest: "Invité",
    member: "Membre",
    pro: "PRO",
  };

  const STATUS_LABELS: Record<SpotSubmissionStatus, string> = {
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
    all: "Tous",
  };

  const selectedSubmission = useMemo(
    () =>
      submissions.find((submission) => submission.id === selectedSubmissionId) ??
      submissions[0] ??
      null,
    [submissions, selectedSubmissionId]
  );
  const selectedIsPublic = selectedSubmission?.isPublic ?? true;

  return (
    <SectionCard className="admin-panel-card admin-submissions-card">
      <div className="admin-section-head admin-submissions-head">
        <div>
          <p className="admin-eyebrow">Spots proposés</p>
          <h3>Validations des contributions</h3>
          <p className="admin-header-sub">Passe en revue chaque spot avant publication.</p>
        </div>
        <div className="admin-submissions-filter">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`admin-filter-btn ${filter === option.value ? "is-active" : ""}`}
              onClick={() => onFilterChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="admin-submissions-grid">
        <div className="admin-submissions-list">
          <div className="admin-submission-row admin-submission-row-head">
            <span>Nom</span>
            <span>Ville / région</span>
            <span>Source</span>
            <span>Utilisateur</span>
            <span>Date</span>
            <span>Status</span>
          </div>
          {submissions.length === 0 && (
            <p className="admin-empty-text">Aucune soumission pour le moment.</p>
          )}
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className={`admin-submission-row ${
                selectedSubmissionId === submission.id ? "is-selected" : ""
              }`}
              onClick={() => onSelectSubmission(submission.id)}
            >
              <span>{submission.title}</span>
              <span>
                {submission.city || submission.region
                  ? `${submission.city ?? "—"} / ${submission.region ?? "—"}`
                  : "—"}
              </span>
              <span>{SOURCE_LABELS[submission.source]}</span>
              <span>
                {submission.createdByDisplayName ||
                  submission.createdByEmail ||
                  (submission.source === "guest" ? "Invité" : "Profil")}
              </span>
              <span>
                {new Date(submission.createdAt).toLocaleDateString("fr-CA", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              <span className={`admin-pill ${"pill-" + submission.status}`}>
                {STATUS_LABELS[submission.status]}
              </span>
            </div>
          ))}
        </div>
        <div className="admin-submission-detail">
          {selectedSubmission ? (
            <>
              <div className="admin-submission-detail-head">
                <div>
                  <p className="admin-submission-label">Titre</p>
                  <h3>{selectedSubmission.title}</h3>
                </div>
                <span className={`admin-pill ${"pill-" + selectedSubmission.status}`}>
                  {STATUS_LABELS[selectedSubmission.status]}
                </span>
              </div>
              <div className="admin-submission-metadata">
                <div>
                  <span>Source</span>
                  <strong>{SOURCE_LABELS[selectedSubmission.source]}</strong>
                </div>
                <div>
                  <span>Contributeur</span>
                  <strong>
                    {selectedSubmission.createdByDisplayName ||
                      selectedSubmission.createdByEmail ||
                      (selectedSubmission.source === "guest" ? "Invité" : "Profil")}
                  </strong>
                </div>
                <div>
                  <span>Ville / Région</span>
                  <strong>
                    {selectedSubmission.city || selectedSubmission.region
                      ? `${selectedSubmission.city ?? "—"} / ${selectedSubmission.region ?? "—"}`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <span>Visibilité</span>
                  <strong>{selectedIsPublic ? "Public" : "PRO"}</strong>
                </div>
                <div>
                  <span>Niveau de risque</span>
                  <strong>{selectedSubmission.riskLevel ?? "—"}</strong>
                </div>
                <div>
                  <span>Catégorie</span>
                  <strong>{selectedSubmission.category ?? "—"}</strong>
                </div>
              </div>
              <div className="admin-submission-section">
                <p className="admin-submission-label">Description</p>
                <p>{selectedSubmission.descriptionFull ?? selectedSubmission.descriptionShort ?? "—"}</p>
              </div>
              <div className="admin-submission-preview">
                <div className="admin-submission-preview-map">
                  <span>{selectedSubmission.coordinates.lat.toFixed(4)}</span>
                  <span>{selectedSubmission.coordinates.lng.toFixed(4)}</span>
                </div>
                <button
                  type="button"
                  className="admin-link-btn"
                  onClick={() => onCenterMap(selectedSubmission)}
                >
                  Ouvrir sur la map
                </button>
              </div>
              <div className="admin-submission-photos">
                {selectedSubmission.photos && selectedSubmission.photos.length > 0 ? (
                  selectedSubmission.photos.map((photo) => (
                    <div
                      key={photo}
                      className="admin-submission-photo"
                      style={{ backgroundImage: `url(${photo})` }}
                      role="img"
                      aria-label="Photo du spot"
                    />
                  ))
                ) : (
                  <p className="admin-empty-text">Aucune photo jointe.</p>
                )}
              </div>
              {selectedSubmission.notesForAdmin && (
                <div className="admin-submission-section">
                  <p className="admin-submission-label">Infos supplémentaires</p>
                  <p>{selectedSubmission.notesForAdmin}</p>
                </div>
              )}
              <div className="admin-submission-section">
                <p className="admin-submission-label">Classification du spot</p>
                <select
                  className="admin-toolbar-select"
                  value={spotTier}
                  onChange={(e) => onSpotTierChange(e.target.value as "STANDARD" | "EPIC" | "GHOST")}
                  style={{ width: "100%", marginBottom: "12px" }}
                >
                  <option value="STANDARD">🌍 STANDARD – Spot classique</option>
                  <option value="EPIC">👑 EPIC – Spot légendaire</option>
                  <option value="GHOST">👻 GHOST – Spot rare et caché</option>
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={spotIsProOnly}
                    onChange={(e) => onSpotIsProOnlyChange(e.target.checked)}
                  />
                  <span>🔒 Réservé aux membres PRO uniquement</span>
                </label>
              </div>
              <label className="admin-submission-rejection">
                <span>Motif de refus (facultatif)</span>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => onReasonChange(e.target.value)}
                  placeholder="Explique pourquoi ce spot ne doit pas être publié."
                />
              </label>
              <div className="admin-submission-actions">
                <UrbexButton
                  variant="primary"
                  onClick={() => onApprove(selectedSubmission)}
                  disabled={processingId === selectedSubmission.id}
                >
                  {processingId === selectedSubmission.id ? "Traitement…" : "Approuver"}
                </UrbexButton>
                <UrbexButton
                  variant="danger"
                  onClick={() => onReject(selectedSubmission)}
                  disabled={processingId === selectedSubmission.id}
                >
                  {processingId === selectedSubmission.id ? "Traitement…" : "Refuser"}
                </UrbexButton>
              </div>
            </>
          ) : (
            <p className="admin-empty-text">Sélectionne une soumission pour visualiser les détails.</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function AdminHistoriesPage({ places }: { places: Place[] }) {
  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Histoires</p>
          <h3>Histoires des lieux</h3>
        </div>
      </div>
      <div className="admin-table">
        <div className="admin-table-head">
          <span>Lieu</span>
          <span>Résumé</span>
          <span>Dernière maj</span>
          <span>Action</span>
        </div>
        {places.map((p) => (
          <div key={p.id} className="admin-table-row">
            <span>{p.title || p.name}</span>
            <span>{p.historyShort || "Pas de résumé"}</span>
            <span>
              {p.createdAt
                ? new Date(p.createdAt).toLocaleDateString("fr-CA", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
            <span>
              <button
                className="admin-link-btn"
                type="button"
                onClick={() => {
                  const target = `/spot/${p.id}/edit-history`;
                  window.history.pushState({}, "", target);
                  window.dispatchEvent(new CustomEvent("urbex-nav", { detail: { path: target } }));
                }}
              >
                Éditer l’histoire
              </button>
            </span>
          </div>
        ))}
        {places.length === 0 && <p className="admin-empty-text">Aucune histoire pour l’instant.</p>}
      </div>
    </SectionCard>
  );
}

function AdminUsersPage({ users }: { users: AdminUser[] }) {
  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Communauté</p>
          <h3>Utilisateurs</h3>
        </div>
      </div>
      <div className="admin-table">
        <div className="admin-table-head">
          <span>Nom</span>
          <span>Email</span>
          <span>Statut</span>
          <span>Inscription</span>
        </div>
        {users.map((user) => (
          <div key={user.uid} className="admin-table-row">
            <span>{user.displayName || "Profil sans nom"}</span>
            <span>{user.email || "—"}</span>
            <span className={`admin-pill ${user.isPro ? "pill-pro" : "pill-live"}`}>
              {user.isAdmin ? "Admin" : user.isPro ? "PRO" : "Membre"}
            </span>
            <span>
              {user.createdAt
                ? new Date(user.createdAt).toLocaleDateString("fr-CA", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "—"}
            </span>
          </div>
        ))}
        {users.length === 0 && <p className="admin-empty-text">Aucun utilisateur.</p>}
      </div>
    </SectionCard>
  );
}

function AdminProductsPage({
  products,
  onAdd,
  onEdit,
}: {
  products: ShopProduct[];
  onAdd: () => void;
  onEdit: (p: ShopProduct) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | ShopProductStatus>("all");

  const filtered = products.filter((p) => {
    const matchesSearch = search.trim()
      ? `${p.name} ${p.category}`.toLowerCase().includes(search.trim().toLowerCase())
      : true;
    const matchesStatus = status === "all" ? true : p.status === status;
    return matchesSearch && matchesStatus;
  });

  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head admin-section-head--split">
        <div>
          <p className="admin-eyebrow">Boutique</p>
          <h3>Produits</h3>
          <p className="admin-header-sub">Catalogue prêt pour l’intégration Printful.</p>
        </div>
        <div className="admin-toolbar">
          <input
            type="search"
            className="admin-toolbar-input"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="admin-toolbar-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="draft">Brouillon</option>
          </select>
          <UrbexButton variant="primary" onClick={onAdd}>
            + Ajouter un produit
          </UrbexButton>
        </div>
      </div>
      <div className="admin-table admin-table--products">
        <div className="admin-table-head admin-table-head--shop">
          <span>Image</span>
          <span>Nom</span>
          <span>Catégorie</span>
          <span>Prix</span>
          <span>Statut</span>
          <span>Dernière mise à jour</span>
          <span>Action</span>
        </div>
        {filtered.map((p) => (
          <div key={p.id} className="admin-table-row admin-table-row--product">
            <span>
              {p.images?.[0] ? (
                <img className="admin-thumb" src={p.images[0]} alt={p.name} />
              ) : (
                <div className="story-media-placeholder admin-thumb" />
              )}
            </span>
            <span className="admin-strong">{p.name}</span>
            <span className="admin-muted">{p.category || "—"}</span>
            <span>{p.price.toFixed(2)} CAD</span>
            <span className={`admin-pill ${p.status === "active" ? "pill-live" : "pill-muted"}`}>
              {p.status === "active" ? "Actif" : "Brouillon"}
            </span>
            <span className="admin-muted">{p.updatedAt?.toLocaleDateString?.("fr-CA")}</span>
            <span>
              <button className="admin-link-btn" type="button" onClick={() => onEdit(p)}>
                Modifier
              </button>
            </span>
          </div>
        ))}
        {filtered.length === 0 && <p className="admin-empty-text">Aucun produit.</p>}
      </div>
    </SectionCard>
  );
}

function AdminOrdersPage({
  orders,
  customers,
  onCreateTest,
  selectedOrderId,
  onSelectOrder,
  onStatusChange,
}: {
  orders: ShopOrder[];
  customers: ShopCustomer[];
  onCreateTest: () => Promise<void>;
  selectedOrderId: string | null;
  onSelectOrder: (id: string | null) => void;
  onStatusChange: (id: string, status: ShopOrderStatus) => Promise<void>;
}) {
  const detail = orders.find((o) => o.id === selectedOrderId) || null;
  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head admin-section-head--split">
        <div>
          <p className="admin-eyebrow">Boutique</p>
          <h3>Commandes</h3>
        </div>
        <div className="admin-toolbar">
          <span className="admin-pill pill-muted">TODO : sync Printful orders here</span>
          <UrbexButton variant="secondary" onClick={onCreateTest}>
            + Créer une commande test
          </UrbexButton>
        </div>
      </div>
      <div className="admin-table admin-table--orders">
        <div className="admin-table-head admin-table-head--shop">
          <span>#Commande</span>
          <span>Date</span>
          <span>Client</span>
          <span>Montant</span>
          <span>Statut</span>
          <span>Action</span>
        </div>
        {orders.map((o) => {
          const customer = customers.find((c) => c.id === o.customerId);
          return (
            <div key={o.id} className="admin-table-row">
              <span>{o.id}</span>
              <span>{o.createdAt ? o.createdAt.toLocaleDateString("fr-CA") : "—"}</span>
              <span>{customer?.displayName || o.customerId}</span>
              <span>{o.totalAmount.toFixed(2)} CAD</span>
              <span className="admin-pill pill-muted">{o.status}</span>
              <span>
                <button className="admin-link-btn" type="button" onClick={() => onSelectOrder(o.id)}>
                  Voir
                </button>
              </span>
            </div>
          );
        })}
        {orders.length === 0 && <p className="admin-empty-text">Aucune commande.</p>}
      </div>

      {detail && (
        <div className="admin-order-detail">
          <div className="admin-section-head">
            <h4>Détail commande {detail.id}</h4>
            <UrbexButton variant="secondary" onClick={() => onSelectOrder(null)}>
              Fermer
            </UrbexButton>
          </div>
          <p>
            Client : {customers.find((c) => c.id === detail.customerId)?.displayName || detail.customerId}
          </p>
          <p>Montant : {detail.totalAmount.toFixed(2)} CAD</p>
          <p>Date : {detail.createdAt?.toLocaleString?.("fr-CA")}</p>
          <p>Statut :</p>
          <select
            value={detail.status}
            onChange={(e) => onStatusChange(detail.id, e.target.value as ShopOrderStatus)}
          >
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="shipped">shipped</option>
            <option value="cancelled">cancelled</option>
          </select>
          <div className="admin-table" style={{ marginTop: 12 }}>
            <div className="admin-table-head" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
              <span>Produit</span>
              <span>Quantité</span>
              <span>Prix</span>
            </div>
            {detail.items.map((item, idx) => (
              <div key={idx} className="admin-table-row" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
                <span>{item.productId}</span>
                <span>{item.quantity}</span>
                <span>{item.unitPrice.toFixed(2)} CAD</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function AdminCustomersPage({
  customers,
  onAdd,
}: {
  customers: ShopCustomer[];
  onAdd: () => void;
}) {
  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Boutique</p>
          <h3>Clients</h3>
        </div>
        <UrbexButton variant="secondary" onClick={onAdd}>
          + Ajouter un client
        </UrbexButton>
      </div>
      <div className="admin-table admin-table--customers">
        <div className="admin-table-head admin-table-head--shop">
          <span>Nom</span>
          <span>Email</span>
          <span>Statut</span>
          <span>Commandes</span>
          <span>Date d’inscription</span>
        </div>
        {customers.map((u) => (
          <div key={u.id} className="admin-table-row">
            <span>{u.displayName || "Profil sans nom"}</span>
            <span>{u.email || "—"}</span>
            <span className={`admin-pill ${u.isProMember ? "pill-pro" : "pill-live"}`}>
              {u.isProMember ? "Membre PRO" : "Membre"}
            </span>
            <span className="admin-muted">{u.lastOrderId ? 1 : 0}</span>
            <span>{u.createdAt ? u.createdAt.toLocaleDateString("fr-CA") : "—"}</span>
          </div>
        ))}
        {customers.length === 0 && <p className="admin-empty-text">Aucun client pour l’instant.</p>}
      </div>
    </SectionCard>
  );
}

function AdminStatsPage({
  kpis,
}: {
  kpis: { publicCount: number; proCount: number; proMembers: number; revenueMonthly: number; revenueAnnual: number; productsCount: number; ordersCount: number };
}) {
  return (
    <div className="admin-grid-2">
      <SectionCard>
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Analyse</p>
            <h3>Statistiques</h3>
          </div>
        </div>
        <div className="admin-kpi-grid">
          <KpiCard label="Spots publics" value={kpis.publicCount} />
          <KpiCard label="Spots PRO" value={kpis.proCount} />
          <KpiCard label="Membres PRO actifs" value={kpis.proMembers} />
          <KpiCard label="Revenus estimés / mois" value={`${kpis.revenueMonthly.toFixed(2)} $`} />
          <KpiCard label="ARR projeté" value={`${kpis.revenueAnnual.toFixed(0)} $`} />
          <KpiCard label="Produits" value={kpis.productsCount} />
          <KpiCard label="Commandes" value={kpis.ordersCount} />
        </div>
      </SectionCard>
      <SectionCard>
        <div className="admin-section-head">
          <div>
            <p className="admin-eyebrow">Activité</p>
            <h3>Activité récente</h3>
            <p className="admin-header-sub">Placeholders en attendant les logs.</p>
          </div>
        </div>
        <div className="admin-placeholder-chart" />
        <ul className="admin-activity">
          <li>Ajout de spot · Placeholder</li>
          <li>Nouvelle commande merch · Placeholder</li>
          <li>Nouveau membre PRO · Placeholder</li>
        </ul>
      </SectionCard>
    </div>
  );
}

type ModuleToggleKey = keyof typeof DEFAULT_ADMIN_UI_CONFIG.modules;
type FlagToggleKey = keyof typeof DEFAULT_ADMIN_UI_CONFIG.flags;

const MODULE_TOGGLES: Array<{
  key: ModuleToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "adminSettings",
    label: "Paramètres admin",
    description: "La page ⚙️ reste visible, même si le module est désactivé.",
  },
  {
    key: "mapUi",
    label: "Map UI",
    description: "Gère le centre de configuration Map UI sans toucher aux routes.",
  },
  {
    key: "themes",
    label: "Thèmes",
    description: "Montre ou masque l’éditeur de thèmes et ses versions Bêta.",
  },
  {
    key: "uiConfig",
    label: "Config UI",
    description: "Active le tableau de bord Config UI lié aux tokens publics.",
  },
  {
    key: "overlayStudio",
    label: "Overlay Studio",
    description: "Permet la page Overlay Studio pour ajuster les cartes.",
  },
  {
    key: "integrations",
    label: "Intégrations",
    description: "Affiche les connecteurs Printful/Stripe et les actions associées.",
  },
];

const FLAG_TOGGLES: Array<{
  key: FlagToggleKey;
  label: string;
  description: string;
}> = [
  {
    key: "proBeta",
    label: "Barre Pro Bêta",
    description: "Affiche le badge Bêta sur les éléments PRO en cours de test.",
  },
  {
    key: "overlayStudio",
    label: "Overlay Studio Bêta",
    description: "Signale visuellement que l’Overlay Studio est expérimental.",
  },
  {
    key: "themesBeta",
    label: "Thèmes Bêta",
    description: "Ajoute un label Bêta sur la section Thèmes et ses publications.",
  },
];

function AdminSettingsPage() {
  const { config, loading, savePatch, error, metadata } = useAdminUiConfig();
  const { isSuperAdmin } = useCurrentUserRole();
  const modulesState = config?.modules ?? DEFAULT_ADMIN_UI_CONFIG.modules;
  const flagsState = config?.flags ?? DEFAULT_ADMIN_UI_CONFIG.flags;
  const maintenanceState = config?.maintenance ?? DEFAULT_ADMIN_UI_CONFIG.maintenance;
  const initialMessage = maintenanceState.message ?? "";
  const [messageDraft, setMessageDraft] = useState(initialMessage);

  useEffect(() => {
    setMessageDraft(initialMessage);
  }, [initialMessage]);

  const debouncedMessage = useDebouncedValue(messageDraft, 400);
  useEffect(() => {
    if (debouncedMessage === initialMessage) {
      return;
    }
    savePatch({ maintenance: { message: debouncedMessage } });
  }, [debouncedMessage, initialMessage, savePatch]);

  const handleModuleToggle = (key: ModuleToggleKey) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    savePatch({ modules: { [key]: event.target.checked } });
  };

  const handleFlagToggle = (key: FlagToggleKey) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    savePatch({ flags: { [key]: event.target.checked } });
  };

  const handleMaintenanceToggle = (event: ChangeEvent<HTMLInputElement>) => {
    savePatch({ maintenance: { enabled: event.target.checked } });
  };

  const editingDisabled = metadata.configLocked && !isSuperAdmin;

  return (
    <SectionCard>
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Configuration</p>
          <h3>Paramètres admin</h3>
        </div>
      </div>
      {editingDisabled && (
        <p className="admin-status admin-status--warning">
          Le brouillon est verrouillé, les contrôles sont en lecture seule.
        </p>
      )}
      <fieldset className="admin-settings-grid" disabled={editingDisabled}>
        <section className="admin-settings-card">
          <h3>Modules</h3>
          <p>Active ou désactive des sections du panneau sans perdre les routes.</p>
          <div className="admin-module-grid">
            {MODULE_TOGGLES.map((module) => {
              const enabled = modulesState[module.key];
              return (
                <div
                  key={module.key}
                  className={`admin-module-entry ${enabled ? "" : "is-disabled"}`}
                >
                  <div>
                    <strong>{module.label}</strong>
                    <p className="admin-module-entry__meta">{module.description}</p>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      disabled={loading}
                      checked={enabled}
                      onChange={handleModuleToggle(module.key)}
                    />
                    <span>{enabled ? "Activé" : "Désactivé"}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
        <section className="admin-settings-card">
          <h3>Maintenance</h3>
          <p>
            Affiche une page d’alerte globale sans bloquer l’accès aux admins.
          </p>
          <label className="admin-switch">
            <input
              type="checkbox"
              disabled={loading}
              checked={maintenanceState.enabled}
              onChange={handleMaintenanceToggle}
            />
            <span>{maintenanceState.enabled ? "Activée" : "Désactivée"}</span>
          </label>
          <label className="admin-field">
            <span>Message d’entretien</span>
            <input
              type="text"
              value={messageDraft}
              disabled={loading}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder="Message affiché aux visiteurs"
            />
          </label>
        </section>
        <section className="admin-settings-card">
          <h3>Feature flags (Bêta)</h3>
          <p>Active les expérimentations sans modifier la structure.</p>
          <div className="admin-flag-grid">
            {FLAG_TOGGLES.map((flag) => {
              const enabled = flagsState[flag.key];
              return (
                <div key={flag.key} className="admin-flag-entry">
                  <div>
                    <div className="admin-flag-entry__title">
                      <strong>{flag.label}</strong>
                      <span className="admin-flag-pill">BÊTA</span>
                    </div>
                    <p className="admin-flag-entry__meta">{flag.description}</p>
                  </div>
                  <label className="admin-switch">
                    <input
                      type="checkbox"
                      disabled={loading}
                      checked={enabled}
                      onChange={handleFlagToggle(flag.key)}
                    />
                    <span>{enabled ? "Activé" : "Désactivé"}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      </fieldset>
      {import.meta.env.DEV && (
        <p
          className={`admin-settings-firestore-status ${
            error ? "is-error" : "is-ok"
          }`}
        >
          Firestore: {error ? "bloqué ❌" : "synced ✅"}
        </p>
      )}
    </SectionCard>
  );
}

type AdminUiTokenKey =
  | "topbarHeight"
  | "proBarMaxWidth"
  | "overlayPanelWidth"
  | "overlayRadius"
  | "glassBlur"
  | "glowIntensity";

const UI_TOKEN_FIELDS: ReadonlyArray<{
  key: AdminUiTokenKey;
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  format?: (value: number) => string;
}> = [
  {
    key: "topbarHeight",
    label: "Hauteur du topbar",
    description: "Détermine la hauteur du header fixe.",
    min: 48,
    max: 96,
    step: 1,
    unit: "px",
  },
  {
    key: "proBarMaxWidth",
    label: "Largeur max barre PRO",
    description: "Limite la largeur de la barre PRO centrale.",
    min: 320,
    max: 720,
    step: 10,
    unit: "px",
  },
  {
    key: "overlayPanelWidth",
    label: "Largeur des overlays",
    description: "Fait varier la largeur des cards overlay.",
    min: 280,
    max: 520,
    step: 10,
    unit: "px",
  },
  {
    key: "overlayRadius",
    label: "Rayon des cartes overlay",
    description: "Arrondit les coins des panneaux flottants.",
    min: 8,
    max: 42,
    step: 2,
    unit: "px",
  },
  {
    key: "glassBlur",
    label: "Flou glassmorphism",
    description: "Contrôle le blur backdrop sur les cartes overlay.",
    min: 0,
    max: 32,
    step: 1,
    unit: "px",
  },
  {
    key: "glowIntensity",
    label: "Intensité glow",
    description: "Augmente l’éclat / halo autour des éléments.",
    min: 0.2,
    max: 1,
    step: 0.05,
    format: (value) => value.toFixed(2),
  },
];

function AdminConfigTokensCard() {
  const { config, loading, savePatch } = useAdminUiConfig();
  const ui = config?.ui ?? DEFAULT_ADMIN_UI_CONFIG.ui;
  const normalizedTokens = useMemo(
    () => ({
      topbarHeight:
        ui.topbarHeight ??
        ui.headerHeight ??
        DEFAULT_ADMIN_UI_CONFIG.ui.topbarHeight,
      proBarMaxWidth: ui.proBarMaxWidth,
      overlayPanelWidth: ui.overlayPanelWidth,
      overlayRadius: ui.overlayRadius,
      glassBlur: ui.glassBlur,
      glowIntensity: ui.glowIntensity,
    }),
    [
      ui.topbarHeight,
      ui.headerHeight,
      ui.proBarMaxWidth,
      ui.overlayPanelWidth,
      ui.overlayRadius,
      ui.glassBlur,
      ui.glowIntensity,
    ]
  );
  const [tokenValues, setTokenValues] = useState(() => ({ ...normalizedTokens }));
  useEffect(() => {
    setTokenValues(normalizedTokens);
  }, [normalizedTokens]);

  const debouncedTokenValues = useDebouncedValue(tokenValues, 400);

  useEffect(() => {
    if (loading) return;
    const patch: Partial<AdminUiConfig["ui"]> = {};
    if (normalizedTokens.topbarHeight !== debouncedTokenValues.topbarHeight) {
      patch.topbarHeight = debouncedTokenValues.topbarHeight;
      patch.headerHeight = debouncedTokenValues.topbarHeight;
    }
    if (normalizedTokens.proBarMaxWidth !== debouncedTokenValues.proBarMaxWidth) {
      patch.proBarMaxWidth = debouncedTokenValues.proBarMaxWidth;
    }
    if (
      normalizedTokens.overlayPanelWidth !==
      debouncedTokenValues.overlayPanelWidth
    ) {
      patch.overlayPanelWidth = debouncedTokenValues.overlayPanelWidth;
    }
    if (
      normalizedTokens.overlayRadius !== debouncedTokenValues.overlayRadius
    ) {
      patch.overlayRadius = debouncedTokenValues.overlayRadius;
    }
    if (normalizedTokens.glassBlur !== debouncedTokenValues.glassBlur) {
      patch.glassBlur = debouncedTokenValues.glassBlur;
    }
    if (
      normalizedTokens.glowIntensity !== debouncedTokenValues.glowIntensity
    ) {
      patch.glowIntensity = debouncedTokenValues.glowIntensity;
    }
    if (Object.keys(patch).length === 0) return;
    savePatch({ ui: patch });
  }, [
    loading,
    savePatch,
    normalizedTokens.topbarHeight,
    normalizedTokens.proBarMaxWidth,
    normalizedTokens.overlayPanelWidth,
    normalizedTokens.overlayRadius,
    normalizedTokens.glassBlur,
    normalizedTokens.glowIntensity,
    debouncedTokenValues.topbarHeight,
    debouncedTokenValues.proBarMaxWidth,
    debouncedTokenValues.overlayPanelWidth,
    debouncedTokenValues.overlayRadius,
    debouncedTokenValues.glassBlur,
    debouncedTokenValues.glowIntensity,
  ]);

  return (
    <SectionCard>
      <div className="admin-section-head">
        <div>
          <p className="admin-eyebrow">Tokens dynamiques</p>
          <h3>Config UI</h3>
          <p>Contrôle la hauteur/topbar, les cards overlay et le glow.</p>
        </div>
      </div>
      <div className="admin-grid">
        {UI_TOKEN_FIELDS.map((field) => {
          const value = tokenValues[field.key];
          const formattedValue = field.format
            ? field.format(value)
            : `${value}${field.unit ?? "px"}`;
          return (
            <label key={field.key} className="admin-field">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "baseline",
                }}
              >
                <span>{field.label}</span>
                <span
                  className="admin-settings-meta"
                  style={{ margin: 0, fontSize: "0.9rem" }}
                >
                  {formattedValue}
                </span>
              </div>
              <input
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={loading}
                value={value}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  setTokenValues((previous) => ({
                    ...previous,
                    [field.key]: nextValue,
                  }));
                }}
              />
              <small style={{ opacity: 0.75 }}>{field.description}</small>
            </label>
          );
        })}
      </div>
    </SectionCard>
  );
}

const HEALTH_REFRESH_INTERVAL = 60_000;

type IntegrationHealthServiceKey = Exclude<keyof IntegrationHealthData, "checkedAt">;

const INTEGRATION_HEALTH_ORDER: IntegrationHealthServiceKey[] = [
  "stripe",
  "printful",
  "mapbox",
  "firebase",
];

const INTEGRATION_HEALTH_LABELS: Record<IntegrationHealthServiceKey, string> = {
  stripe: "Stripe / Paiements",
  printful: "Printful",
  mapbox: "Mapbox",
  firebase: "Firebase",
};

type IntegrationStatusKey = IntegrationHealthData["stripe"]["status"];

const STATUS_LABELS: Record<IntegrationStatusKey, string> = {
  ok: "OK",
  degraded: "DEGRADED",
  down: "DOWN",
};

const STATUS_CLASS_MAP: Record<IntegrationStatusKey, string> = {
  ok: "pill-ok",
  degraded: "pill-degraded",
  down: "pill-down",
};

type IntegrationHealthEntry = {
  key: IntegrationHealthServiceKey;
  label: string;
  payload: IntegrationHealthData[IntegrationHealthServiceKey];
};

function AdminIntegrationsPage({
  integrations,
  onToggle,
  onOpenModal,
  onSyncPrintful,
  syncingPrintful,
}: {
  integrations: IntegrationSettings[];
  onToggle: (id: IntegrationSettings["id"], enabled: boolean) => void;
  onOpenModal: (id: IntegrationSettings["id"]) => void;
  onSyncPrintful: () => void;
  syncingPrintful: boolean;
}) {
  const printful = integrations.find((i) => i.id === "printful");
  const stripe = integrations.find((i) => i.id === "stripe");
  const [healthData, setHealthData] = useState<IntegrationHealthData | null>(
    null
  );
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const healthControllerRef = useRef<AbortController | null>(null);

  const refreshHealth = useCallback(async () => {
    healthControllerRef.current?.abort();
    const controller = new AbortController();
    healthControllerRef.current = controller;
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await fetchIntegrationHealth(controller.signal);
      if (controller.signal.aborted) {
        return;
      }
      setHealthData(data);
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      console.error("[UQ][INTEGRATION_HEALTH]", error);
      setHealthError(
        error instanceof Error ? error.message : "Erreur lors de la récupération."
      );
      setHealthData(null);
    } finally {
      if (!controller.signal.aborted) {
        setHealthLoading(false);
      }
      healthControllerRef.current = null;
    }
  }, []);

  useEffect(() => {
    refreshHealth();
    if (typeof window === "undefined") {
      return () => {
        healthControllerRef.current?.abort();
      };
    }
    const timer = window.setInterval(refreshHealth, HEALTH_REFRESH_INTERVAL);
    return () => {
      window.clearInterval(timer);
      healthControllerRef.current?.abort();
    };
  }, [refreshHealth]);

  const formatTimestamp = useCallback((value?: string) => {
    if (!value) return "—";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }
    return parsed.toLocaleString("fr-CA");
  }, []);

  const healthItems = useMemo<IntegrationHealthEntry[]>(
    () =>
      !healthData
        ? []
        : INTEGRATION_HEALTH_ORDER.map((key) => ({
            key,
            label: INTEGRATION_HEALTH_LABELS[key],
            payload: healthData[key],
          })),
    [healthData]
  );

  return (
    <SectionCard className="admin-panel-card">
      <div className="admin-section-head admin-section-head--split">
        <div>
          <p className="admin-eyebrow">Connecteurs</p>
          <h3>Intégrations</h3>
          <p className="admin-header-sub">
            Supervise la santé des services externes sans exposer de clés sensibles.
          </p>
        </div>
        <div className="admin-header-actions">
          <UrbexButton
            variant="secondary"
            onClick={refreshHealth}
            disabled={healthLoading}
          >
            {healthLoading ? "Actualisation…" : "Actualiser"}
          </UrbexButton>
        </div>
      </div>
      {healthError && (
        <p className="admin-integration-health-error">
          <span className="admin-pill pill-down">Bloqué ❌</span>
          {healthError}
        </p>
      )}
      <div className="admin-integration-health-meta">
        <span>
          Dernière vérification :{" "}
          {healthData ? formatTimestamp(healthData.checkedAt) : "—"}
        </span>
        <span>Auto-refresh toutes les {HEALTH_REFRESH_INTERVAL / 1000}s</span>
      </div>
      <div className="admin-integration-health-grid">
        {healthItems.length === 0 && !healthLoading && !healthError && (
          <p className="admin-muted">Statuts en attente…</p>
        )}
        {healthItems.map((service) => (
          <article
            key={service.key}
            className="admin-integration-health-card"
          >
            <header className="admin-integration-health-card__header">
              <strong>{service.label}</strong>
              <span
                className={`admin-pill ${STATUS_CLASS_MAP[service.payload.status]}`}
              >
                {STATUS_LABELS[service.payload.status]}
              </span>
            </header>
            <div className="admin-integration-health-card__meta">
              {service.payload.note && <span>{service.payload.note}</span>}
              {service.payload.lastEventAt && (
                <span>
                  Dernier événement : {formatTimestamp(service.payload.lastEventAt)}
                </span>
              )}
              {service.key === "firebase" && (
                <span>
                  App Check :{" "}
                  {(service.payload as IntegrationHealthData["firebase"])
                    .appCheckOk
                    ? "OK"
                    : "Bloqué"}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className="admin-integrations-grid">
        <div className="admin-integration-card">
          <div>
            <p className="admin-eyebrow">Printful</p>
            <h4>Connexion Printful</h4>
            <p className="admin-header-sub">
              Synchronise produits et commandes de la boutique. Prépare tes clés API et webhooks.
            </p>
            <p className="admin-pill pill-muted">
              État : {printful?.enabled ? "Connecté" : "Déconnecté"}
            </p>
            <p className="admin-pill pill-muted">Webhook : Connecté (placeholder)</p>
          </div>
          <div className="admin-toolbar">
            <span className="admin-pill pill-muted">Préprod</span>
            <div style={{ display: "flex", gap: 8 }}>
              <UrbexButton
                variant="primary"
                onClick={onSyncPrintful}
                disabled={syncingPrintful}
              >
                {syncingPrintful ? "Sync en cours..." : "Synchroniser Produits Printful"}
              </UrbexButton>
              <UrbexButton
                variant={printful?.enabled ? "danger" : "primary"}
                onClick={() => onToggle("printful", !printful?.enabled)}
              >
                {printful?.enabled ? "Déconnecter" : "Activer l’intégration"}
              </UrbexButton>
            </div>
          </div>
        </div>
        <div className="admin-integration-card">
          <div>
            <p className="admin-eyebrow">Stripe / Paiements</p>
            <h4>Onboarding à venir</h4>
            <p className="admin-header-sub">
              Placeholder pour gérer les paiements merch et PRO. Ajoute les champs clés API et webhooks ici.
            </p>
            <p className="admin-pill pill-muted">
              État : {stripe?.enabled ? "Activé" : "En préparation"}
            </p>
          </div>
          <div className="admin-toolbar">
            <span className="admin-pill pill-muted">Sandbox</span>
            <div style={{ display: "flex", gap: 8 }}>
              <UrbexButton variant="secondary" onClick={() => onOpenModal("stripe")}>
                Configurer
              </UrbexButton>
              <UrbexButton
                variant={stripe?.enabled ? "danger" : "primary"}
                onClick={() => onToggle("stripe", !stripe?.enabled)}
              >
                {stripe?.enabled ? "Désactiver" : "Activer"}
              </UrbexButton>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function ProductModal({
  initial,
  onClose,
  onSave,
}: {
  initial: Partial<ShopProduct> | null;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    price: number;
    category?: string;
    image: string;
    status: ShopProductStatus;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [status, setStatus] = useState<ShopProductStatus>((initial?.status as ShopProductStatus) ?? "draft");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.images?.[0] ?? "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const isNameValid = name.trim().length >= 3;
  const isPriceValid = Number(price) > 0;
  const isStatusValid = status === "active" || status === "draft";
  const isImageValid = !!imageUrl;
  const formValid = isNameValid && isPriceValid && isStatusValid && isImageValid;

  async function handleSubmit() {
    setError(null);
    if (!formValid) {
      setError("Complète les champs requis.");
      return;
    }
    setSaving(true);
    try {
      let uploadedUrl = imageUrl;
      if (imageFile) {
        setUploading(true);
        const pid = initial?.id || `temp-${Date.now()}`;
        uploadedUrl = await uploadProductImage(pid, imageFile);
        setUploading(false);
      }
      await onSave({
        name: name.trim(),
        category: category.trim() || undefined,
        price: Number(price) || 0,
        status,
        description: description.trim() || "",
        image: uploadedUrl,
      });
    } catch (err: any) {
      setError(err?.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="admin-section-head">
          <h3>{initial ? "Modifier le produit" : "Ajouter un produit"}</h3>
          <button className="admin-link-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
        <div className="admin-grid-2">
          <label className="edit-field">
            <span>Nom</span>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="edit-field">
            <span>Catégorie</span>
            <input value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
        </div>
        <div className="admin-grid-2">
          <label className="edit-field">
            <span>Prix (CAD)</span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
            />
          </label>
          <label className="edit-field">
            <span>Statut</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as ShopProductStatus)}>
              <option value="active">Actif</option>
              <option value="draft">Brouillon</option>
            </select>
          </label>
        </div>
        <label className="edit-field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label className="edit-field">
          <span>Image principale</span>
          <div className="product-upload">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setUploadError(null);
                if (file) {
                  setImageFile(file);
                  setImageUrl(URL.createObjectURL(file));
                }
              }}
            />
            {imageUrl && <img src={imageUrl} alt="Aperçu" className="product-thumb" />}
          </div>
          {!isImageValid && <p className="edit-history-error">Image requise</p>}
          {uploadError && <p className="edit-history-error">{uploadError}</p>}
        </label>
        {!isNameValid && <p className="edit-history-error">Nom requis (min 3 caractères)</p>}
        {!isPriceValid && <p className="edit-history-error">Prix requis (&gt; 0)</p>}
        {!isStatusValid && <p className="edit-history-error">Statut requis</p>}
        {error && <p className="edit-history-error">{error}</p>}
        <div className="admin-header-actions">
          <UrbexButton variant="secondary" onClick={onClose}>
            Annuler
          </UrbexButton>
          <UrbexButton variant="primary" onClick={handleSubmit} disabled={saving || uploading || !formValid}>
            {saving || uploading ? "Enregistrement..." : "Enregistrer"}
          </UrbexButton>
        </div>
      </div>
    </div>
  );
}

function CustomerModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (data: { displayName: string; email: string; isProMember: boolean }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isPro, setIsPro] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || !email.trim()) {
      setError("Nom et email requis");
      return;
    }
    setSaving(true);
    try {
      await onSave({ displayName: name.trim(), email: email.trim(), isProMember: isPro });
    } catch (err: any) {
      setError(err?.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="admin-section-head">
          <h3>Ajouter un client</h3>
          <button className="admin-link-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
        <label className="edit-field">
          <span>Nom</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="edit-field">
          <span>Email</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="edit-field">
          <span>Statut PRO</span>
          <input type="checkbox" checked={isPro} onChange={(e) => setIsPro(e.target.checked)} />
        </label>
        {error && <p className="edit-history-error">{error}</p>}
        <div className="admin-header-actions">
          <UrbexButton variant="secondary" onClick={onClose}>
            Annuler
          </UrbexButton>
          <UrbexButton variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? "Enregistrement..." : "Ajouter"}
          </UrbexButton>
        </div>
      </div>
    </div>
  );
}

function IntegrationModal({
  id,
  onClose,
  onConfirm,
}: {
  id: IntegrationSettings["id"];
  onClose: () => void;
  onConfirm: (enabled: boolean) => Promise<void>;
}) {
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onConfirm(enabled);
    setSaving(false);
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <div className="admin-section-head">
          <h3>{id === "printful" ? "Printful" : "Stripe"} (bientôt)</h3>
          <button className="admin-link-btn" onClick={onClose}>
            Fermer
          </button>
        </div>
        <p>
          Cette intégration sera branchée prochainement. Tu peux déjà activer un flag pour indiquer
          l’état de préparation.
        </p>
        <label className="edit-field">
          <span>Activer l’intégration</span>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        </label>
        <div className="admin-header-actions">
          <UrbexButton variant="secondary" onClick={onClose}>
            Annuler
          </UrbexButton>
          <UrbexButton variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </UrbexButton>
        </div>
      </div>
    </div>
  );
}

function KpiCardSkeleton() {
  return (
    <div className="admin-kpi-card admin-kpi-card--skeleton">
      <span className="admin-kpi-skeleton-line admin-kpi-skeleton-line--label" />
      <span className="admin-kpi-skeleton-line admin-kpi-skeleton-line--value" />
    </div>
  );
}

function KpiCard({
  label,
  value,
  badge,
  accent,
  info,
  onClick,
}: {
  label: string;
  value: string | number;
  badge?: string;
  accent?: boolean;
  info?: string;
  onClick?: () => void;
}) {
  const className = `admin-kpi-card ${accent ? "is-accent" : ""} ${onClick ? "is-clickable" : ""}`;
  const content = (
    <>
      <p className="admin-kpi-label">
        {label} {badge && <span className="admin-pill pill-muted">{badge}</span>}
        {info && (
          <span className="admin-kpi-info" role="img" aria-label={info} title={info}>
            i
          </span>
        )}
      </p>
      <h3 className="admin-kpi-value">{value}</h3>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
