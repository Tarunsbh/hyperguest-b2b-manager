// ============================================================
// HyperGuest B2B Channel Manager - TypeScript Type Definitions
// ============================================================

// -------------------- AUTH / CONFIG --------------------
export interface ApiConfig {
  staticToken: string;         // For property list, enable subscription
  operationsToken: string;     // For property details, search, bookings
  callbackToken: string;       // For ARI callback (Eglobe endpoint)
  baseStaticUrl: string;
  baseSearchUrl: string;
  basePdmUrl: string;
  baseBookUrl: string;
  callbackUrl: string;
}

// -------------------- PROPERTY --------------------
export interface PropertyListItem {
  id: number;
  name: string;
  rating?: number;
  countryCode?: string;
  city?: string;
  status?: string;
  currency?: string;
  checkIn?: string;
  checkOut?: string;
}

export interface PropertyCoordinates {
  longitude: number;
  latitude: number;
}

export interface PropertyCity {
  id: number;
  hereMapsId?: string;
  name: string;
}

export interface PropertyLocation {
  countryCode: string;
  city: PropertyCity;
  address: string;
  postcode: string;
  region: string;
}

export interface PropertyContact {
  phone: string;
  email: string;
  website: string;
}

export interface HotelType {
  id: number;
  name: string;
}

export interface PropertySettings {
  numberOfFloors: number | null;
  numberOfRooms: number | null;
  hotelType: HotelType;
  timezone: string;
  utcOffset: number;
  maxInfantAge: number;
  maxChildAge: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  cutOff: string;
  chain: string;
}

export interface Commission {
  value: number;
  chargeType: string;
  calculation: string;
}

export interface RoomSettings {
  maxOccupancy?: number;
  maxAdults?: number;
  maxChildren?: number;
  [key: string]: unknown;
}

export interface Room {
  id: number;
  type: string;
  name: string;
  status: string;
  settings?: RoomSettings;
  code?: string;
}

export interface RatePlan {
  id: number;
  name: string;
  code: string;
  status: string;
  mealPlan?: string;
  cancellationPolicy?: string;
}

export interface PropertyDetail {
  id: number;
  name: string;
  rating: number;
  group: string;
  status: string;
  coordinates: PropertyCoordinates;
  location: PropertyLocation;
  contact: PropertyContact;
  updated: string;
  created: string;
  isTest: number;
  settings: PropertySettings;
  roomsAndRatePlansMapping: Record<string, string[]>;
  commission: Commission;
  rooms: Room[];
  ratePlans?: RatePlan[];
}

// -------------------- FACILITY --------------------
export interface Facility {
  id: number;
  name: string;
  category?: string;
  type?: string;
}

// -------------------- SEARCH --------------------
export interface SearchParams {
  checkIn: string;
  nights: number;
  guests: number;
  hotelIds: string | number;
  customerNationality: string;
}

export interface GuestCount {
  adults: number;
  children: number;
  infants: number;
}

export interface RoomRate {
  roomTypeCode: string;
  ratePlanCode: string;
  currency: string;
  pricePerRoom?: number;
  pricePerPerson?: number;
  amountAfterTax?: number;
  amountBeforeTax?: number;
  taxesIncluded?: boolean;
  mealPlan?: string;
  cancellationPolicy?: string;
  availableRooms?: number;
}

export interface SearchRoomResult {
  roomId: number;
  roomName: string;
  roomTypeCode: string;
  rates: RoomRate[];
}

export interface SearchResult {
  hotelId: number;
  hotelName?: string;
  currency?: string;
  rooms?: SearchRoomResult[];
  [key: string]: unknown;
}

// -------------------- CALENDAR --------------------
export interface CalendarParams {
  propertyId: number;
  roomCode: string;
  rateplanCode: string;
  startDate: string;
  endDate: string;
}

export interface AdditionalGuestsRate {
  adults: number;
  children: number;
  infants: number;
}

export interface BaseAmount {
  numberOfGuests: GuestCount;
  price: number;
  taxesIncluded: boolean;
  commissionIncluded: boolean;
}

export interface CalendarDay {
  date: string;
  numberOfAvailableRooms: number;
  isOpen: boolean;
  isOpenOnDeparture: boolean;
  isOpenOnArrival: boolean;
  isOpenOnDepartureOnNextDay: boolean;
  minLOS: number;
  maxLOS: number;
  minAdvancedBookingDays: number;
  release: number;
  pricePerRoomAfterTax: number;
  pricePerPersonAfterTax: number;
  additionalGuestsRate: AdditionalGuestsRate;
  baseAmounts: BaseAmount[];
}

// -------------------- SUBSCRIPTIONS --------------------
export interface RatePlanSubscription {
  propertyId: number;
  ratePlanCodes: string[];
}

export interface SubscriptionAuthentication {
  bearer: string;
}

export interface SubscriptionEnvelopeSubUrls {
  Callback: string;
}

export interface SubscribeRequest {
  method: string;
  propertyIds: number[];
  ratePlans: RatePlanSubscription[];
  userId: string;
  envelope: string;
  authentication: SubscriptionAuthentication;
  envelopeSubUrls: SubscriptionEnvelopeSubUrls;
  email: string;
  parameters: Record<string, unknown>;
  version: number;
}

export interface SubscribeResponse {
  subscriptionId: string;
  status: string;
}

export interface SubscriptionDetail {
  subscriptionId: string;
  userId: string;
  propertyIds: number[];
  method: string;
  version: number;
  envelope: string;
  status: string;
}

// -------------------- BOOKINGS --------------------
export interface BookingGuest {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  postalCode?: string;
  addressLine?: string;
  countryCode?: string;
  state?: string;
  city?: string;
}

export interface BookingRoom {
  roomTypeCode: string;
  ratePlanCode: string;
  numberOfUnits: number;
  adults: number;
  children: number;
  infants: number;
  checkIn: string;
  checkOut: string;
  amountBeforeTax: number;
  amountAfterTax: number;
  currency: string;
}

export interface BookingPushRequest {
  reservationId: string;
  hotelCode: string;
  resStatus: string;
  echoToken: string;
  rooms: BookingRoom[];
  guest: BookingGuest;
  totalAmountBeforeTax: number;
  totalAmountAfterTax: number;
  currency: string;
  timestamp: string;
}

export interface BookingPushResponse {
  success: boolean;
  reservationId?: string;
  status?: string;
  message?: string;
  rawResponse?: string;
}

// -------------------- CALLBACK / ARI UPDATES --------------------
export interface ARIUpdateCallback {
  id?: number;
  receivedAt: string;
  payload: string;
  propertyId?: number;
  status: string;
}

// -------------------- STORED DATA (MSSQL) --------------------
export interface StoredProperty {
  id: number;
  name: string;
  rating: number;
  status: string;
  countryCode: string;
  city: string;
  address: string;
  currency: string;
  checkIn: string;
  checkOut: string;
  latitude: number;
  longitude: number;
  phone: string;
  email: string;
  website: string;
  commission: number;
  commissionType: string;
  isTest: number;
  rawData: string;
  syncedAt: string;
}

export interface StoredSubscription {
  id: number;
  subscriptionId: string;
  userId: string;
  propertyIds: string;
  method: string;
  envelope: string;
  status: string;
  version: number;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredBooking {
  id: number;
  reservationId: string;
  hotelCode: string;
  hotelName?: string;
  resStatus: string;
  checkIn: string;
  checkOut: string;
  guestName: string;
  guestEmail: string;
  rooms: number;
  totalAmount: number;
  currency: string;
  xmlPayload: string;
  response: string;
  success: boolean;
  createdAt: string;
}

export interface StoredCallback {
  id: number;
  receivedAt: string;
  payload: string;
  propertyId?: number;
  status: string;
  processed: boolean;
}

// -------------------- UI STATE --------------------
export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface FilterState {
  search?: string;
  status?: string;
  countryCode?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface SortState {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TableState {
  pagination: PaginationState;
  filters: FilterState;
  sort: SortState;
}

// -------------------- API RESPONSE --------------------
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// -------------------- DASHBOARD --------------------
export interface DashboardStats {
  totalProperties: number;
  activeSubscriptions: number;
  totalBookingsPushed: number;
  totalARICallbacks: number;
  bookingsToday: number;
  callbacksToday: number;
  successRate: number;
}

export interface BookingTrendItem {
  date: string;
  bookings: number;
  amount: number;
}

export interface SubscriptionStatusItem {
  status: string;
  count: number;
}
