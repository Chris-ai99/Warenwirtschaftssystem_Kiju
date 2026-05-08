export type BarcodeDto = {
  id?: string;
  value: string;
  primary: boolean;
  articleUnitId?: string | null;
};

export type ArticleUnitDto = {
  id: string;
  label: string;
  quantity: number;
  sortOrder: number;
  isDefault: boolean;
  active: boolean;
  barcodes?: BarcodeDto[];
};

export type CategoryDto = {
  id: string;
  name: string;
  slug?: string;
  active?: boolean;
};

export type WarehouseDto = {
  id: string;
  name: string;
  code: string;
  type: string;
  active: boolean;
};

export type StockDto = {
  id: string;
  fullQuantity: number;
  emptyQuantity: number;
  reservedQuantity: number;
  warehouse: WarehouseDto;
};

export type ArticleDto = {
  id: string;
  articleNumber: string;
  name: string;
  unit: string;
  purchasePrice: string;
  salePrice: string;
  depositAmount: string;
  description?: string | null;
  imageUrl?: string | null;
  active: boolean;
  supportsEmpties: boolean;
  lowStockThreshold: number;
  category?: CategoryDto | null;
  barcodes: BarcodeDto[];
  units?: ArticleUnitDto[];
  stocks: StockDto[];
  movements?: MovementDto[];
};

export type MovementDto = {
  id: string;
  createdAt: string;
  type: string;
  stockKind: string;
  quantity: number;
  reason?: string | null;
  note?: string | null;
  barcodeValue?: string | null;
  unitLabel?: string | null;
  unitQuantity?: number | null;
  unitCount?: number | null;
  article: Pick<ArticleDto, "id" | "name" | "articleNumber">;
  user: { id?: string; name: string; email?: string };
  fromWarehouse?: WarehouseDto | null;
  toWarehouse?: WarehouseDto | null;
};

export type UserDto = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  role: { code: string; name: string };
};
