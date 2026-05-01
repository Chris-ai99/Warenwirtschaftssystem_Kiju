export type BarcodeDto = {
  id?: string;
  value: string;
  primary: boolean;
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
  active: boolean;
  supportsEmpties: boolean;
  category?: CategoryDto | null;
  barcodes: BarcodeDto[];
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
