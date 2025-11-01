// API service for WebSalesV3 - All endpoints from api.md
// Use Next.js proxy to avoid CORS issues
// Always use the proxy route for consistency between client and server
const API_BASE_URL = '/api/proxy';

// Types based on API responses from api.md
export interface EmployeeDto {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  primaryContact: number;
  secondaryContact: number;
  departmentName: string;
  email: string;
  role: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  pincode: number;
  dateOfJoining: string;
  createdAt: string;
  houseLatitude?: number;
  houseLongitude?: number;
  status?: string;
}

// Alias for backward compatibility
export type Employee = EmployeeDto;

export interface AttendanceRequestPageResponse {
  content: ApprovalRequest[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
  empty: boolean;
}

export interface ApprovalRequest {
  id: number;
  employeeId: number;
  employeeName: string;
  requestDate: string;
  requestedStatus: string;
  logDate: string;
  actionDate: string | null;
  status: string;
}

export interface VisitBrandPurchase {
  id?: number;
  brandName: string;
  purchasedFrom?: string;
}

export interface VisitDto {
  id: number;
  storeId: number;
  storeName: string;
  storeLatitude?: number;
  storeLongitude?: number;
  intent?: number;
  storePrimaryContact?: number;
  employeeId: number;
  employeeName: string;
  visit_date: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  visitLatitude?: number;
  visitLongitude?: number;
  checkinLatitude?: number;
  checkinLongitude?: number;
  checkoutLatitude?: number;
  checkoutLongitude?: number;
  checkinDate?: string;
  checkoutDate?: string;
  checkinTime?: string;
  checkoutTime?: string;
  vehicleType?: string;
  purpose?: string;
  priority?: string;
  outcome?: string;
  feedback?: string;
  attachment?: unknown[];
  attachmentResponse?: unknown[];
  visitIntentId?: number;
  visitIntentValue?: number;
  city?: string;
  district?: string;
  subDistrict?: string;
  state?: string;
  country?: string;
  travelAllowance?: number;
  dearnessAllowance?: number;
  salary?: number;
  isSelfGenerated?: boolean;
  brandsInUse?: string[];
  brandProCons?: unknown[];
  brandPurchases?: VisitBrandPurchase[];
  constructionStage?: string;
  purchasedFrom?: string;
  assignedById?: number;
  assignedByName?: string;
  statsDto?: unknown;
  createdAt?: string;
  createdTime?: string;
  updatedAt?: string;
  updatedTime?: string;
  intentAuditLogDto?: unknown;
  monthlySale?: number;
}

export interface VisitResponse {
  content: VisitDto[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface BrandProCon {
  id: number;
  brandName: string;
  pros: string[];
  cons: string[];
  category?: string | null;
  purchasedFrom?: string | null;
  steelQuantitySold?: number | null;
  cementQuantitySold?: number | null;
}

export interface IntentAuditLog {
  id: number;
  storeId: number;
  storeName: string;
  oldIntentLevel: number;
  newIntentLevel: number;
  employeeId: number;
  employeeName: string;
  changeDate: string;
  changeTime: string;
  visitId: number;
}

export interface MonthlySaleChange {
  id: number;
  storeId: number;
  storeName: string;
  oldMonthlySale: number;
  newMonthlySale: number;
  visitId: number;
  visitDate: string;
  employeeId: number;
  employeeName: string;
  changeDate: string;
  changeTime: string;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  type: string;
  status: string;
  priority: string;
  assignedTo: string;
  dueDate: string;
  visitId: number;
}

export interface Note {
  id: number;
  content: string;
  employeeId: number;
  employeeName: string;
  storeId: number;
  storeName: string;
  visitId: number | null;
  attachment?: unknown[];
  attachmentResponse?: Array<{
    fileName: string;
    fileDownloadUri: string;
    fileType: string;
    tag: string;
    size: number;
  }>;
  createdDate: string;
  updatedDate: string;
  createdTime: string | null;
  updatedTime: string | null;
}

// Alias for backward compatibility
export type Visit = VisitDto;

export interface LiveLocationDto {
  id: number;
  empId: number;
  empName: string;
  latitude: number;
  longitude: number;
  updatedAt: string;
  updatedTime: string;
}

// Alias for backward compatibility
export type EmployeeLocation = LiveLocationDto;

export interface DashboardOverviewResponse {
  startDate: string;
  endDate: string;
  kpi: DashboardOverviewKpi;
  employees: DashboardEmployeeSummary[];
  states: DashboardStateSummary[];
  liveLocations: DashboardLiveLocationSummary[];
}

export interface DashboardOverviewKpi {
  totalVisits: number;
  activeEmployees: number;
  liveLocations: number;
}

export interface DashboardEmployeeSummary {
  employeeId: number;
  employeeName: string | null;
  role: string | null;
  city: string | null;
  state: string | null;
  homeLatitude?: number | null;
  homeLongitude?: number | null;
  totalVisits: number;
  completedVisits: number;
  ongoingVisits: number;
  assignedVisits: number;
  lastVisitAt: string | null;
  lastVisitLatitude?: number | null;
  lastVisitLongitude?: number | null;
  lastVisitStoreName?: string | null;
  liveLocationUpdatedAt?: string | null;
  liveLatitude?: number | null;
  liveLongitude?: number | null;
}

export interface DashboardStateSummary {
  stateName: string;
  activeEmployeeCount: number;
  ongoingVisitCount: number;
  completedVisitCount: number;
}

export interface DashboardLiveLocationSummary {
  employeeId: number;
  employeeName: string;
  latitude: number;
  longitude: number;
  updatedAt: string | null;
  lastVisitAt: string | null;
  lastVisitLatitude?: number | null;
  lastVisitLongitude?: number | null;
  lastVisitStoreName?: string | null;
  fallbackLatitude?: number | null;
  fallbackLongitude?: number | null;
  source?: 'LIVE' | 'VISIT' | 'HOME';
}

export interface DashboardEmployeeVisitPoint {
  visitId: number | null;
  type: 'HOME' | 'CURRENT' | 'CHECKIN' | 'CHECKOUT' | 'VISIT';
  latitude: number;
  longitude: number;
  timestamp: string | null;
  label: string | null;
  storeName?: string | null;
}

export interface AttendanceLogItem {
  id: number;
  employeeId: number;
  employeeName: string;
  attendanceStatus: string;
  visitCount: number;
  uniqueStoreCount?: number;
  travelAllowance?: number;
  dearnessAllowance?: number;
  checkinDate: string;
  checkoutDate: string;
  checkinTime: string;
  checkoutTime: string;
  fullMonthSalary?: number;
}

// Alias for backward compatibility
export type AttendanceLog = AttendanceLogItem;

export interface AttendanceStats {
  weeklyCount?: number;
  monthlyCount?: number;
  yearlyCount?: number;
  uniqueStoreCount: number;
  fullDays: number;
  halfDays: number;
  absences: number;
  travelAllowance: number;
  dearnessAllowance: number;
  salary?: number;
  expenseTotal?: number;
  statsDto: {
    visitCount: number;
    presentDays?: number;
    fullDays: number;
    halfDays: number;
    absences: number;
  };
  employeeId: number;
  employeeName: string;
}

export interface ReportCountsItem {
  weeklyCount?: number;
  monthlyCount?: number;
  yearlyCount?: number;
  uniqueStoreCount: number;
  fullDays: number;
  halfDays: number;
  absences: number;
  travelAllowance: number;
  dearnessAllowance: number;
  salary: number;
  expenseTotal: number;
  statsDto: {
    visitCount: number;
    presentDays: number;
    fullDays: number;
    halfDays: number;
    absences: number;
    expenseTotal: number;
    approvedExpense: number;
  };
  employeeId: number;
  employeeFirstName: string;
  employeeLastName: string;
}

export interface ExpenseDto {
  id: number;
  type: string;
  subType: string;
  amount: number;
  approvalPersonId: number;
  approvalPersonName: string;
  approvalStatus: string;
  description: string;
  approvalDate: string;
  submissionDate: string | null;
  rejectionReason: string | null;
  reimbursedDate: string | null;
  reimbursementAmount: number | null;
  employeeId: number;
  employeeName: string;
  expenseDate: string;
  paymentMethod: string | null;
  attachment: unknown[];
  attachmentResponse: unknown[];
}

export interface StoreDto {
  storeId: number;
  storeName: string;
  clientFirstName: string;
  clientLastName: string;
  primaryContact: number;
  monthlySale: number | null;
  intent: number | null;
  employeeName: string;
  clientType: string | null;
  totalVisitCount: number;
  lastVisitDate: string | null;
  email: string | null;
  city: string;
  state: string;
  country: string | null;
  // Additional fields from API response
  landmark?: string | null;
  district?: string;
  subDistrict?: string;
  managers?: unknown[];
  latitude?: number | null;
  longitude?: number | null;
  brandsInUse?: unknown[];
  employeeId?: number;
  brandProCons?: unknown[];
  visitThisMonth?: number;
  outcomeLastVisit?: string;
  createdAt?: string;
  updatedAt?: string;
  createdTime?: string;
  updatedTime?: string;
  secondaryContact?: number | null;
  industry?: string | null;
  companySize?: string | null;
  gstNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  pincode?: number | null;
  likes?: unknown;
}

export interface StoreResponse {
  content: StoreDto[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: {
      empty: boolean;
      sorted: boolean;
      unsorted: boolean;
    };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  totalPages: number;
  totalElements: number;
  last: boolean;
  size: number;
  number: number;
  sort: {
    empty: boolean;
    sorted: boolean;
    unsorted: boolean;
  };
  numberOfElements: number;
  first: boolean;
  empty: boolean;
}

export interface EmployeeUserDto {
  id: number;
  firstName: string;
  lastName: string;
  employeeId: string;
  email: string;
  role: string;
  departmentName: string;
  userName: string;
  password: string;
  primaryContact: string;
  dateOfJoining: string;
  city: string;
  state: string;
  userDto: {
    username: string;
    password: string | null;
    roles: string | null;
    employeeId: number | null;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface EmployeeStatsWithVisits {
  statsDto: {
    visitCount: number;
    fullDays: number;
    halfDays: number;
    absences: number;
  };
  visitDto: VisitDto[];
}

export interface TeamDataDto {
  id: number;
  office: {
    id: number;
    firstName: string;
    lastName: string;
  };
  fieldOfficers: EmployeeUserDto[];
}

export type TeamAvpValue =
  | number
  | EmployeeDto
  | null
  | Array<number | EmployeeDto | null | undefined>
  | undefined;

export interface TeamResponseDto {
  id: number;
  officeManager: EmployeeDto | null;
  fieldOfficers: EmployeeDto[];
  teamType: string;
  avp?: TeamAvpValue;
}

// Team Hierarchy API Types
export interface ScopedEmployee {
  id: number;
  name: string;
  role: string;
  employeeCode: string | null;
  city: string;
  state: string;
  assignedCities: string[];
}

export interface TeamHierarchy {
  teamId: number;
  teamType: string;
  avp: ScopedEmployee | null;
  manager: ScopedEmployee | null;
  fieldOfficers: ScopedEmployee[];
  assignedCities: string[];
}

export interface TeamHierarchyResponse {
  currentEmployee: ScopedEmployee;
  scopeRole: string;
  teams: TeamHierarchy[];
}

export interface TeamCreateRequest {
  officeManager: number;
  fieldOfficers: number[];
}

export interface CurrentUserDto {
  password: string;
  username: string;
  authorities: Array<{
    authority: string;
  }>;
  accountNonExpired: boolean;
  accountNonLocked: boolean;
  credentialsNonExpired: boolean;
  enabled: boolean;
}

export interface TimelineDay {
  date: string;
  employeeId: number;
  employeeName: string;
  activities: ActivityDto[];
  visits: VisitDto[];
  visitCount: number;
  activityCount: number;
  workSummary: string;
}

export interface ActivityDto {
  id: number;
  title?: string;
  description?: string;
  activityDate?: string;
  employeeId?: number;
  employeeName?: string;
  employeeRole?: string;
  createdById?: number;
  createdByName?: string;
  createdDate?: string;
  createdTime?: string;
  updatedDate?: string;
  updatedTime?: string;
}

export interface CombinedTimelineItem {
  id: number;
  type: "VISIT" | "ACTIVITY";
  date: string | null;
  time?: string | null;
  employeeName?: string | null;
  visit?: VisitDto;
  activity?: ActivityDto;
}

export interface CombinedTimelineResponse {
  items: CombinedTimelineItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  totalVisits: number;
  totalActivities: number;
  availablePurposes: string[];
  availableExecutives: string[];
}

export interface CombinedTimelineParams {
  start: string;
  end: string;
  page?: number;
  size?: number;
  sort?: "asc" | "desc";
  employeeId?: number | null;
  storeName?: string;
  purpose?: string;
  executiveName?: string;
}

export interface TimelineResponse {
  content: TimelineDay[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface StateDto {
  id: number;
  stateName: string;
}

export interface DistrictDto {
  id: number;
  districtName: string;
  stateId: number;
  stateName: string;
}

export interface SubDistrictDto {
  id: number;
  subDistrictName: string;
  districtId: number;
  districtName: string;
}

export interface CityDto {
  id: number;
  cityName: string;
  subDistrictId: number;
  subDistrictName: string;
}

// API Service Class
export class API {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.loadToken();
  }

  // Static methods for backward compatibility
  static async getEmployees(): Promise<EmployeeUserDto[]> {
    return apiService.getAllEmployees();
  }

  static async getReportCounts(startDate: string, endDate: string): Promise<ReportCountsItem[]> {
    return apiService.getReportCounts(startDate, endDate);
  }

  static async getAttendanceByDate(date: string): Promise<AttendanceLogItem[]> {
    return apiService.getAttendanceForRange(date, date);
  }

  static async getAttendanceForRange(startDate: string, endDate: string): Promise<AttendanceLogItem[]> {
    return apiService.getAttendanceForRange(startDate, endDate);
  }



  static async getVisitsByDateSorted(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', storeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsByDateSorted(startDate, endDate, page, size, sort, storeName);
  }

  static async getVisitsForTeam(teamId: number, startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, storeName?: string): Promise<VisitResponse> {
    return apiService.getVisitsForTeam(teamId, startDate, endDate, page, size, sort, purpose, priority, storeName);
  }

  static async getVisitsByDateRange(startDate: string, endDate: string): Promise<VisitDto[]> {
    return apiService.getVisitsByDateRange(startDate, endDate);
  }

  static async createVisit(visit: Partial<VisitDto>): Promise<number> {
    return apiService.createVisit(visit);
  }

  static async getTimelineByDateRange(employeeId: number | null, startDate: string, endDate: string): Promise<TimelineDay[]> {
    return apiService.getTimelineByDateRange(employeeId, startDate, endDate);
  }
  
  static async getCombinedTimeline(params: CombinedTimelineParams): Promise<CombinedTimelineResponse> {
    return apiService.getCombinedTimeline(params);
  }

  static async getDashboardOverview(startDate?: string, endDate?: string): Promise<DashboardOverviewResponse> {
    return apiService.getDashboardOverview(startDate, endDate);
  }

  static async getEmployeeVisitTrail(employeeId: number, startDate?: string, endDate?: string): Promise<DashboardEmployeeVisitPoint[]> {
    return apiService.getEmployeeVisitTrail(employeeId, startDate, endDate);
  }

  static async createNote(noteData: {
    content: string;
    employeeId: number;
    storeId: number;
    visitId: number;
  }): Promise<number> {
    return apiService.createNote(noteData);
  }

  static async getAllNotes(): Promise<Note[]> {
    return apiService.getAllNotes();
  }

  static async getStoresFiltered(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreDto[]> {
    return apiService.getStoresFiltered(params);
  }

  static async getStoresFilteredPaginated(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    dealerSubType?: string;
    employeeName?: string;
    primaryContact?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
    sort?: string;
  }): Promise<StoreResponse> {
    return apiService.getStoresFilteredPaginated(params);
  }

  static async getStoresByEmployee(employeeId: number, params: {
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreResponse> {
    return apiService.getStoresByEmployee(employeeId, params);
  }

  static async deleteStore(storeId: number): Promise<void> {
    return apiService.deleteStore(storeId);
  }

  static async exportStores(): Promise<string> {
    return apiService.exportStores();
  }

  // Employee-related static methods
  static async getAllEmployees(): Promise<EmployeeUserDto[]> {
    return apiService.getAllEmployees();
  }

  static async getEmployeeDirectory(): Promise<EmployeeDto[]> {
    return apiService.getEmployeeDirectory();
  }

  static async getAllFieldOfficers(city?: string, state?: string): Promise<EmployeeDto[]> {
    return apiService.getAllFieldOfficers(city, state);
  }

  static async getEmployeeById(id: number): Promise<EmployeeUserDto> {
    return apiService.getEmployeeById(id);
  }

  static async getTeamByEmployee(employeeId: number): Promise<TeamDataDto[]> {
    return apiService.getTeamByEmployee(employeeId);
  }

  static async getTeams(): Promise<TeamResponseDto[]> {
    return apiService.getTeams();
  }

  static async getTeamHierarchyScoped(): Promise<TeamHierarchyResponse> {
    return apiService.getTeamHierarchyScoped();
  }

  static async createTeam(payload: TeamCreateRequest): Promise<number> {
    return apiService.createTeam(payload);
  }

  static async addTeamFieldOfficers(teamId: number, fieldOfficerIds: number[]): Promise<string> {
    return apiService.addTeamFieldOfficers(teamId, fieldOfficerIds);
  }

  static async removeTeamFieldOfficers(teamId: number, fieldOfficerIds: number[]): Promise<string> {
    return apiService.removeTeamFieldOfficers(teamId, fieldOfficerIds);
  }

  static async updateTeamLead(teamId: number, officeManagerId: number): Promise<string> {
    return apiService.updateTeamLead(teamId, officeManagerId);
  }

  static async updateTeamAvp(teamId: number, avpId: number | null): Promise<string> {
    return apiService.updateTeamAvp(teamId, avpId);
  }

  static async deleteTeam(teamId: number): Promise<string> {
    return apiService.deleteTeam(teamId);
  }

  static async getCities(): Promise<string[]> {
    return apiService.getCities();
  }

  static async getAllInactiveEmployees(): Promise<EmployeeUserDto[]> {
    return apiService.getAllInactiveEmployees();
  }

  static async createEmployee(employeeData: unknown): Promise<unknown> {
    return apiService.createEmployee(employeeData);
  }

  static async updateEmployee(empId: number, employeeData: unknown): Promise<unknown> {
    return apiService.updateEmployee(empId, employeeData);
  }

  static async deleteEmployee(id: number): Promise<unknown> {
    return apiService.deleteEmployee(id);
  }

  static async resetPassword(username: string, password: string): Promise<unknown> {
    return apiService.resetPassword(username, password);
  }

  static async editUsername(id: number, username: string): Promise<unknown> {
    return apiService.editUsername(id, username);
  }

  static async setEmployeeActive(id: number): Promise<unknown> {
    return apiService.setEmployeeActive(id);
  }

  static async getEmployeeStatsByDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return apiService.getEmployeeStatsByDateRange(employeeId, startDate, endDate);
  }

  static async getEmployeeStatsWithVisits(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return apiService.getEmployeeStatsWithVisits(employeeId, startDate, endDate);
  }

  static async getEmployeeLiveLocation(employeeId: number): Promise<LiveLocationDto> {
    return apiService.getEmployeeLiveLocation(employeeId);
  }

  static async getAllEmployeeLocations(): Promise<LiveLocationDto[]> {
    return apiService.getAllEmployeeLocations();
  }

  static async createAttendanceLog(employeeId: number): Promise<unknown> {
    return apiService.createAttendanceLog(employeeId);
  }

  static async getCurrentUser(): Promise<CurrentUserDto> {
    return apiService.getCurrentUser();
  }

  static async getStoresForTeam(teamId: number, page: number = 0, size: number = 10): Promise<StoreResponse> {
    return apiService.getStoresForTeam(teamId, page, size);
  }

  // Location static methods
  static async getAllStates(): Promise<StateDto[]> {
    return apiService.getAllStates();
  }

  static async getDistrictsByStateId(stateId: number): Promise<DistrictDto[]> {
    return apiService.getDistrictsByStateId(stateId);
  }

  static async getDistrictsByStateName(stateName: string): Promise<DistrictDto[]> {
    return apiService.getDistrictsByStateName(stateName);
  }

  static async getSubDistrictsByDistrictId(districtId: number): Promise<SubDistrictDto[]> {
    return apiService.getSubDistrictsByDistrictId(districtId);
  }

  static async getCitiesBySubDistrictId(subDistrictId: number): Promise<CityDto[]> {
    return apiService.getCitiesBySubDistrictId(subDistrictId);
  }

  static async getAllCities(): Promise<CityDto[]> {
    return apiService.getAllCities();
  }

  private loadToken(): void {
    if (typeof window !== 'undefined') {
      // Client-side: get from localStorage
      this.token = localStorage.getItem('authToken');
    } else {
      // Server-side: cannot use async cookies() in constructor
      // Token will be loaded from Authorization header instead
      this.token = null;
    }
  }

  private getHeaders(): HeadersInit {
    // Always refresh token before building headers to avoid stale auth
    this.loadToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'User-Agent': 'IConSteel-Frontend',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    console.log('🌐 Making API request:', {
      url,
      method: config.method || 'GET',
      headers: config.headers,
      hasToken: !!this.token
    });

    try {
      const response = await fetch(url, config);
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        // Try to extract error details from body (JSON or text)
        let bodySnippet = '';
        try {
          if (contentType.includes('application/json')) {
            const errJson = await response.json();
            bodySnippet = typeof errJson === 'string' ? errJson : JSON.stringify(errJson);
          } else {
            bodySnippet = await response.text();
          }
        } catch {
          // ignore body parsing errors
        }
        const preview = bodySnippet ? ` Body: ${bodySnippet.slice(0, 200)}` : '';
        throw new Error(`API request failed: ${response.status} ${response.statusText}.${preview}`);
      }

      // No content
      if (response.status === 204) {
        return undefined as unknown as T;
      }

      // Ensure we only parse JSON when it is JSON
      if (!contentType || !contentType.toLowerCase().includes('application/json')) {
        const text = await response.text();
        
        // For certain endpoints that might return HTML or other formats when no data exists,
        // return empty array instead of throwing error
        const visitEndpoints = [
          '/monthly-sale/getByVisit',
          '/intent-audit/getByVisit', 
          '/task/getByVisit',
          '/notes/getByVisit'
        ];
        
        if (visitEndpoints.some(visitEndpoint => endpoint.includes(visitEndpoint)) && response.ok) {
          console.warn(`Non-JSON response from ${endpoint}, returning empty array. Response: ${text.slice(0, 200)}`);
          return [] as unknown as T;
        }
        
        const preview = text.slice(0, 200);
        throw new Error(
          `Expected JSON but received '${contentType || 'unknown'}' from ${url}. Body starts with: ${preview}`
        );
      }

      return await response.json();
    } catch (error) {
      console.error(`🚨 API request failed for ${endpoint}:`, error);
      console.error('🌐 Request details:', {
        url,
        method: config.method || 'GET',
        hasToken: !!this.token,
        tokenPreview: this.token ? `${this.token.substring(0, 20)}...` : 'No token'
      });
      
      // If it's a network error, provide more helpful error message
      if (error instanceof TypeError && error.message === 'Failed to fetch') {
        console.error('🌐 Network Error Details:', {
          url,
          baseUrl: this.baseUrl,
          error: error.message,
          possibleCauses: [
            'CORS policy blocking the request',
            'API server is down or unreachable',
            'Network connectivity issues',
            'Invalid URL or endpoint',
            'Authentication token expired or invalid'
          ]
        });
        throw new Error(`Network error: Unable to connect to API server at ${this.baseUrl}. Please check your internet connection and try again.`);
      }
      
      throw error;
    }
  }

  // Employee APIs



  async updateEmployeeLiveLocation(id: number, latitude: number, longitude: number): Promise<string> {
    return this.makeRequest<string>(`/employee/updateLiveLocation?id=${id}&latitude=${latitude}&longitude=${longitude}`, {
      method: 'PUT',
    });
  }

  // Visit APIs
  async getAllVisits(): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>('/visit/getAll');
  }

  async getVisitsByEmployee(employeeId: number): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByEmployee?employeeId=${employeeId}`);
  }

  async getVisitsByDateRange(startDate: string, endDate: string): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByDateRange?start=${startDate}&end=${endDate}`);
  }

  async getVisitsByEmployeeAndDateRange(employeeId: number, startDate: string, endDate: string): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByEmployeeAndDateRange?employeeId=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  async getEmployeeStatsByDateRange(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return this.makeRequest<EmployeeStatsWithVisits>(`/visit/getByDateRangeAndEmployeeStats?id=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  async getEmployeeStatsWithVisits(employeeId: number, startDate: string, endDate: string): Promise<EmployeeStatsWithVisits> {
    return this.getEmployeeStatsByDateRange(employeeId, startDate, endDate);
  }

  async getVisitsByDateSorted(startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', storeName?: string): Promise<VisitResponse> {
    let url = `/visit/getByDateSorted?startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}&sort=${sort}`;
    if (storeName && storeName.trim() !== '') {
      url += `&storeName=${encodeURIComponent(storeName.trim())}`;
    }
    console.log('API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<VisitResponse>(url);
  }

  async getVisitsForTeam(teamId: number, startDate: string, endDate: string, page: number = 0, size: number = 10, sort: string = 'visitDate,desc', purpose?: string, priority?: string, storeName?: string): Promise<VisitResponse> {
    let url = `/visit/getForTeam?teamId=${teamId}&startDate=${startDate}&endDate=${endDate}&page=${page}&size=${size}&sort=${sort}`;
    
    if (purpose && purpose.trim() !== '') {
      url += `&purpose=${encodeURIComponent(purpose.trim())}`;
    }
    
    if (priority && priority.trim() !== '') {
      url += `&priority=${encodeURIComponent(priority.trim())}`;
    }
    
    if (storeName && storeName.trim() !== '') {
      url += `&storeName=${encodeURIComponent(storeName.trim())}`;
    }
    
    console.log('Team API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<VisitResponse>(url);
  }

  async getTimelineByDateRange(employeeId: number | null, startDate: string, endDate: string): Promise<TimelineDay[]> {
    let url = `/timeline/getByDateRange?start=${startDate}&end=${endDate}`;
    if (employeeId) {
      url += `&employeeId=${employeeId}`;
    }
    console.log('Timeline API URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<TimelineDay[]>(url);
  }
  
  async getCombinedTimeline(params: CombinedTimelineParams): Promise<CombinedTimelineResponse> {
    const {
      start,
      end,
      page = 0,
      size = 20,
      sort = 'desc',
      employeeId,
      storeName,
      purpose,
      executiveName,
    } = params;
    
    let url = `/timeline/combined?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&page=${page}&size=${size}&sort=${encodeURIComponent(sort)}`;
    
    if (employeeId !== undefined && employeeId !== null) {
      url += `&employeeId=${employeeId}`;
    }
    if (storeName && storeName.trim() !== '') {
      url += `&storeName=${encodeURIComponent(storeName.trim())}`;
    }
    if (purpose && purpose.trim() !== '') {
      url += `&purpose=${encodeURIComponent(purpose.trim())}`;
    }
    if (executiveName && executiveName.trim() !== '') {
      url += `&executiveName=${encodeURIComponent(executiveName.trim())}`;
    }
    
    console.log('Combined Timeline URL:', `${this.baseUrl}${url}`);
    return this.makeRequest<CombinedTimelineResponse>(url);
  }

  // Visit detail APIs
  async getVisitById(id: number): Promise<VisitDto> {
    return this.makeRequest<VisitDto>(`/visit/getById?id=${id}`);
  }

  async getVisitProCons(visitId: number): Promise<BrandProCon[]> {
    return this.makeRequest<BrandProCon[]>(`/visit/getProCons?visitId=${visitId}`);
  }

  async addBrandProCons(visitId: number, brandData: {
    brandName: string;
    pros: string[];
    cons: string[];
  }[]): Promise<void> {
    return this.makeRequest<void>(`/visit/addProCons?visitId=${visitId}`, {
      method: 'PUT',
      body: JSON.stringify(brandData),
    });
  }

  async deleteBrandProCons(visitId: number, brandData: {
    brandName: string;
  }[]): Promise<void> {
    return this.makeRequest<void>(`/visit/deleteProCons?visitId=${visitId}`, {
      method: 'POST',
      body: JSON.stringify(brandData),
    });
  }

  async getIntentAuditByVisit(id: number): Promise<IntentAuditLog[]> {
    return this.makeRequest<IntentAuditLog[]>(`/intent-audit/getByVisit?id=${id}`);
  }

  async getMonthlySaleByVisit(visitId: number): Promise<MonthlySaleChange[]> {
    return this.makeRequest<MonthlySaleChange[]>(`/monthly-sale/getByVisit?visitId=${visitId}`);
  }

  async getTasksByVisit(type: string, visitId: number): Promise<Task[]> {
    return this.makeRequest<Task[]>(`/task/getByVisit?type=${type}&visitId=${visitId}`);
  }

  async getVisitsByStore(id: number): Promise<VisitDto[]> {
    return this.makeRequest<VisitDto[]>(`/visit/getByStore?id=${id}`);
  }

  // Notes by store
  async getNotesByStore(storeId: number): Promise<Note[]> {
    return this.makeRequest<Note[]>(`/notes/getByStore?id=${storeId}`);
  }

  async getNotesByVisit(id: number): Promise<Note[]> {
    return this.makeRequest<Note[]>(`/notes/getByVisit?id=${id}`);
  }

  async createNote(noteData: {
    content: string;
    employeeId: number;
    storeId: number;
    visitId: number;
  }): Promise<number> {
    return this.makeRequest<number>('/notes/create', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async getAllNotes(): Promise<Note[]> {
    return this.makeRequest<Note[]>('/notes/getAll');
  }

  async updateNote(id: number, noteData: {
    content: string;
    employeeId: number;
    storeId: number;
  }): Promise<void> {
    return this.makeRequest<void>(`/notes/edit?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(noteData),
    });
  }

  async deleteNote(id: number): Promise<void> {
    return this.makeRequest<void>(`/notes/delete?id=${id}`, {
      method: 'DELETE',
    });
  }

  // Attendance APIs
  async getAttendanceForRange(startDate: string, endDate: string): Promise<AttendanceLogItem[]> {
    return this.makeRequest<AttendanceLogItem[]>(`/attendance-log/getForRange1?start=${startDate}&end=${endDate}`);
  }

  async getAttendanceStatsForRange(startDate: string, endDate: string): Promise<AttendanceStats[]> {
    return this.makeRequest<AttendanceStats[]>(`/attendance-log/getForRange?start=${startDate}&end=${endDate}`);
  }

  async getAttendanceForEmployeeAndRange(employeeId: number, startDate: string, endDate: string): Promise<AttendanceStats[]> {
    return this.makeRequest<AttendanceStats[]>(`/attendance-log/getForEmployeeAndRange?employeeId=${employeeId}&start=${startDate}&end=${endDate}`);
  }

  // Report APIs
  async getReportCounts(startDate: string, endDate: string): Promise<ReportCountsItem[]> {
    return this.makeRequest<ReportCountsItem[]>(`/report/getCounts?startDate=${startDate}&endDate=${endDate}`);
  }

  // Expense APIs
  async getExpensesByDateRange(startDate: string, endDate: string): Promise<ExpenseDto[]> {
    return this.makeRequest<ExpenseDto[]>(`/expense/getByDateRange?start=${startDate}&end=${endDate}`);
  }

  // Store APIs
  async getStoresFiltered(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreDto[]> {
    const queryParams = new URLSearchParams();
    
    if (params.storeName) queryParams.append('storeName', params.storeName);
    if (params.ownerName) queryParams.append('clientName', params.ownerName);
    if (params.city && params.city !== 'all') queryParams.append('city', params.city);
    if (params.state && params.state !== 'all') queryParams.append('state', params.state);
    if (params.clientType && params.clientType !== 'all') queryParams.append('clientType', params.clientType);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    
    // Always sort alphabetically by store name by default
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    queryParams.append('sortBy', sortBy);
    queryParams.append('sortOrder', sortOrder);

    const response = await this.makeRequest<StoreResponse>(`/store/filteredValues?${queryParams.toString()}`);
    return response.content;
  }

  async getStoresFilteredPaginated(params: {
    storeName?: string;
    ownerName?: string;
    city?: string;
    state?: string;
    clientType?: string;
    dealerSubType?: string;
    employeeName?: string;
    primaryContact?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: string;
    sort?: string;
  }): Promise<StoreResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.storeName) queryParams.append('storeName', params.storeName);
    if (params.ownerName) queryParams.append('clientFirstName', params.ownerName);
    if (params.city) queryParams.append('city', params.city);
    if (params.state) queryParams.append('state', params.state);
    if (params.clientType) queryParams.append('clientType', params.clientType);
    if (params.dealerSubType) queryParams.append('dealerSubType', params.dealerSubType);
    if (params.employeeName) queryParams.append('employeeName', params.employeeName);
    if (params.primaryContact) {
      const cleanedPhone = params.primaryContact.replace(/\D/g, '');
      if (cleanedPhone) queryParams.append('primaryContact', cleanedPhone);
    }
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.size !== undefined) queryParams.append('size', params.size.toString());
    
    // Handle sorting - use sortBy/sortOrder for calculated fields (visitCount, lastVisitDate)
    // and regular sort parameter for database fields
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    
    // For calculated fields (visitCount, lastVisitDate), use sortBy/sortOrder params
    if (sortBy === 'visitCount' || sortBy === 'lastVisitDate') {
      queryParams.append('sortBy', sortBy);
      queryParams.append('sortOrder', sortOrder);
    } else {
      // For database fields, use Spring's sort parameter
      queryParams.append('sort', `${sortBy},${sortOrder}`);
    }

    return this.makeRequest<StoreResponse>(`/store/filteredValues?${queryParams.toString()}`);
  }

  // Get a single store by ID
  async getStoreById(id: number): Promise<StoreDto> {
    return this.makeRequest<StoreDto>(`/store/getById?id=${id}`);
  }

  // Update store by ID
  async updateStore(id: number, payload: Partial<StoreDto>): Promise<unknown> {
    return this.makeRequest<unknown>(`/store/edit?id=${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async getStoresByEmployee(employeeId: number, params: {
    sortBy?: string;
    sortOrder?: string;
  }): Promise<StoreResponse> {
    const queryParams = new URLSearchParams();
    queryParams.append('id', employeeId.toString());
    
    // Always sort alphabetically by store name by default
    const sortBy = params.sortBy || 'storeName';
    const sortOrder = params.sortOrder || 'asc';
    queryParams.append('sort', `${sortBy},${sortOrder}`);

    return this.makeRequest<StoreResponse>(`/store/getByEmployeeWithSort?${queryParams.toString()}`);
  }

  async deleteStore(storeId: number): Promise<void> {
    return this.makeRequest<void>(`/store/deleteById?id=${storeId}`, {
      method: 'DELETE',
    });
  }

  async exportStores(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/store/export`, {
      headers: this.getHeaders(),
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    return response.text();
  }

  async getDashboardOverview(startDate?: string, endDate?: string): Promise<DashboardOverviewResponse> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    const endpoint = query ? `/dashboard/overview?${query}` : '/dashboard/overview';
    return this.makeRequest<DashboardOverviewResponse>(endpoint);
  }

  async getEmployeeVisitTrail(employeeId: number, startDate?: string, endDate?: string): Promise<DashboardEmployeeVisitPoint[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString();
    const endpoint = query
      ? `/dashboard/employees/${employeeId}/visit-trail?${query}`
      : `/dashboard/employees/${employeeId}/visit-trail`;
    return this.makeRequest<DashboardEmployeeVisitPoint[]>(endpoint);
  }

  // Dashboard specific APIs
  async getDashboardData(startDate: string, endDate: string) {
    const [employees, visits, reportCounts] = await Promise.all([
      this.getAllEmployees(),
      this.getVisitsByDateRange(startDate, endDate),
      this.getReportCounts(startDate, endDate)
    ]);

    return {
      employees,
      visits,
      reportCounts
    };
  }

  async getEmployeeDashboardData(employeeId: number, startDate: string, endDate: string) {
    const [employee, visits, attendanceStats] = await Promise.all([
      this.getEmployeeById(employeeId),
      this.getVisitsByEmployeeAndDateRange(employeeId, startDate, endDate),
      this.getAttendanceForEmployeeAndRange(employeeId, startDate, endDate)
    ]);

    return {
      employee,
      visits,
      attendanceStats
    };
  }

  async getAllEmployeeLocations(): Promise<LiveLocationDto[]> {
    // Use the bulk API endpoint instead of individual calls
    return this.makeRequest<LiveLocationDto[]>('/employee/getAllLiveLocations');
  }

  async getEmployeeLiveLocation(employeeId: number): Promise<LiveLocationDto> {
    return this.makeRequest<LiveLocationDto>(`/employee/getLiveLocation?id=${employeeId}`);
  }

  // Tasks by store and date range (complaints/requirements)
  async getTasksByStoreAndDate(params: { storeId: number; start: string; end: string }): Promise<unknown[]> {
    const { storeId, start, end } = params;
    return this.makeRequest<unknown[]>(`/task/getByStoreAndDate?storeId=${storeId}&start=${start}&end=${end}`);
  }

  // Sites by store
  async getSitesByStore(storeId: number): Promise<unknown[]> {
    return this.makeRequest<unknown[]>(`/site/getByStore?id=${storeId}`);
  }

  // Utility methods
  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  formatDateRange(startDate: Date, endDate: Date): { start: string; end: string } {
    return {
      start: this.formatDate(startDate),
      end: this.formatDate(endDate)
    };
  }

  // Employee-related methods
  async getAllEmployees(): Promise<EmployeeUserDto[]> {
    return this.makeRequest<EmployeeUserDto[]>('/employee/getAll');
  }

  async getEmployeeDirectory(): Promise<EmployeeDto[]> {
    return this.makeRequest<EmployeeDto[]>('/employee/getAll');
  }

  async getEmployeeById(id: number): Promise<EmployeeUserDto> {
    return this.makeRequest<EmployeeUserDto>(`/employee/get?id=${id}`);
  }

  async getTeamByEmployee(employeeId: number): Promise<TeamDataDto[]> {
    return this.makeRequest<TeamDataDto[]>(`/employee/team/getByEmployee?id=${employeeId}`);
  }

  async getTeams(): Promise<TeamResponseDto[]> {
    return this.makeRequest<TeamResponseDto[]>('/employee/team/getAll');
  }

  async createTeam(payload: TeamCreateRequest): Promise<number> {
    return this.makeRequest<number>('/employee/team/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async addTeamFieldOfficers(teamId: number, fieldOfficerIds: number[]): Promise<string> {
    return this.makeRequest<string>(`/employee/team/addFieldOfficer?id=${teamId}`, {
      method: 'PUT',
      body: JSON.stringify({ fieldOfficers: fieldOfficerIds }),
    });
  }

  async removeTeamFieldOfficers(teamId: number, fieldOfficerIds: number[]): Promise<string> {
    return this.makeRequest<string>(`/employee/team/deleteFieldOfficer?id=${teamId}`, {
      method: 'DELETE',
      body: JSON.stringify({ fieldOfficers: fieldOfficerIds }),
    });
  }

  async updateTeamLead(teamId: number, officeManagerId: number): Promise<string> {
    return this.makeRequest<string>(`/employee/team/editOfficeManager?id=${teamId}`, {
      method: 'PUT',
      body: JSON.stringify({ officeManager: officeManagerId }),
    });
  }

  async updateTeamAvp(teamId: number, avpId: number | null): Promise<string> {
    return this.makeRequest<string>(`/employee/team/editAvp?id=${teamId}`, {
      method: 'PUT',
      body: JSON.stringify({ avp: avpId }),
    });
  }

  async deleteTeam(teamId: number): Promise<string> {
    return this.makeRequest<string>(`/employee/team/delete?id=${teamId}`, {
      method: 'DELETE',
    });
  }

  async getCities(): Promise<string[]> {
    return this.makeRequest<string[]>('/employee/getCities');
  }

  async getAllInactiveEmployees(): Promise<EmployeeUserDto[]> {
    return this.makeRequest<EmployeeUserDto[]>('/employee/getAllInactive');
  }

  async createEmployee(employeeData: unknown): Promise<unknown> {
    return this.makeRequest<unknown>('/employee-user/create', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    });
  }

  async updateEmployee(empId: number, employeeData: unknown): Promise<unknown> {
    return this.makeRequest<unknown>(`/employee/edit?empId=${empId}`, {
      method: 'PUT',
      body: JSON.stringify(employeeData),
    });
  }

  async deleteEmployee(id: number): Promise<unknown> {
    return this.makeRequest<unknown>(`/employee/delete?id=${id}`, {
      method: 'PUT',
    });
  }

  async resetPassword(username: string, password: string): Promise<unknown> {
    return this.makeRequest<unknown>('/user/manage/update', {
      method: 'PUT',
      body: JSON.stringify({ username, password }),
    });
  }

  async editUsername(id: number, username: string): Promise<unknown> {
    return this.makeRequest<unknown>(`/employee/editUsername?id=${id}&username=${username}`, {
      method: 'PUT',
    });
  }

  async setEmployeeActive(id: number): Promise<unknown> {
    return this.makeRequest<unknown>(`/employee/setActive?id=${id}`, {
      method: 'PUT',
    });
  }

  async createAttendanceLog(employeeId: number): Promise<unknown> {
    return this.makeRequest<unknown>(`/attendance-log/createAttendanceLog?employeeId=${employeeId}`, {
      method: 'POST',
    });
  }

  async getCurrentUser(): Promise<CurrentUserDto> {
    return this.makeRequest<CurrentUserDto>('/user/manage/current-user');
  }

  async getStoresForTeam(teamId: number, page: number = 0, size: number = 10): Promise<StoreResponse> {
    return this.makeRequest<StoreResponse>(`/store/getForTeam?teamId=${teamId}&page=${page}&size=${size}`);
  }

  // Location APIs
  async getAllStates(): Promise<StateDto[]> {
    const allowedStatesConfig = [
      { canonical: 'MAHARASHTRA', aliases: ['MAHARASHTRA'] },
      { canonical: 'MADHYA PRADESH', aliases: ['MADHYA PRADESH', 'MP'] },
      { canonical: 'GUJARAT', aliases: ['GUJARAT'] },
      { canonical: 'KARNATAKA', aliases: ['KARNATAKA'] },
    ] as const;

    const aliasToCanonical = new Map<string, string>();
    const sortOrder: Record<string, number> = {};

    allowedStatesConfig.forEach((config, index) => {
      sortOrder[config.canonical] = index;
      config.aliases.forEach((alias) => {
        aliasToCanonical.set(alias, config.canonical);
      });
    });

    const states = await this.makeRequest<StateDto[]>('/location/states');

    const filteredStateMap = new Map<string, StateDto>();
    states.forEach((state) => {
      const normalizedName = state.stateName?.trim().toUpperCase().replace(/\s+/g, ' ');
      if (!normalizedName) return;

      const canonical = aliasToCanonical.get(normalizedName);
      if (!canonical) return;

      if (!filteredStateMap.has(canonical)) {
        filteredStateMap.set(canonical, state);
      }
    });

    return Array.from(filteredStateMap.entries())
      .sort((a, b) => (sortOrder[a[0]] ?? Number.MAX_SAFE_INTEGER) - (sortOrder[b[0]] ?? Number.MAX_SAFE_INTEGER))
      .map(([, state]) => state);
  }

  async getDistrictsByStateId(stateId: number): Promise<DistrictDto[]> {
    return this.makeRequest<DistrictDto[]>(`/location/districts?stateId=${stateId}`);
  }

  async getDistrictsByStateName(stateName: string): Promise<DistrictDto[]> {
    return this.makeRequest<DistrictDto[]>(`/location/districts?stateName=${encodeURIComponent(stateName)}`);
  }

  async getSubDistrictsByDistrictId(districtId: number): Promise<SubDistrictDto[]> {
    return this.makeRequest<SubDistrictDto[]>(`/location/subDistricts?districtId=${districtId}`);
  }

  async getCitiesBySubDistrictId(subDistrictId: number): Promise<CityDto[]> {
    return this.makeRequest<CityDto[]>(`/location/cities?subDistrictId=${subDistrictId}`);
  }

  async getAllCities(): Promise<CityDto[]> {
    return this.makeRequest<CityDto[]>('/location/allCities');
  }

  // Bulk Visit Assignment APIs
  async getTeamFieldOfficers(): Promise<EmployeeDto[]> {
    return this.makeRequest<EmployeeDto[]>('/employee/getTeamFieldOfficers');
  }

  async getTeamHierarchyScoped(): Promise<TeamHierarchyResponse> {
    return this.makeRequest<TeamHierarchyResponse>('/employee/team/hierarchy/scoped');
  }

  async getAllFieldOfficers(city?: string, state?: string): Promise<EmployeeDto[]> {
    const params = new URLSearchParams();
    if (city) params.append('city', city);
    if (state) params.append('state', state);
    const queryString = params.toString();
    return this.makeRequest<EmployeeDto[]>(`/employee/getAllFieldOfficers${queryString ? `?${queryString}` : ''}`);
  }

  async bulkGetForGrid(employeeIds: number[], startDate: string, endDate: string): Promise<Record<number, Record<string, VisitDto | null>>> {
    const params = new URLSearchParams();
    employeeIds.forEach(id => params.append('employeeIds', id.toString()));
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    return this.makeRequest<Record<number, Record<string, VisitDto | null>>>(`/visit/bulkGetForGrid?${params.toString()}`);
  }

  async getDealersForEmployee(employeeId: number): Promise<StoreDto[]> {
    return this.makeRequest<StoreDto[]>(`/store/getDealersForEmployee?employeeId=${employeeId}`);
  }

  async bulkCreateVisits(visits: VisitDto[]): Promise<{ created: number; failed: number; errors: string[] }> {
    return this.makeRequest<{ created: number; failed: number; errors: string[] }>('/visit/bulkCreate', {
      method: 'POST',
      body: JSON.stringify(visits),
    });
  }

  async createVisit(visit: Partial<VisitDto>): Promise<number> {
    const response = await this.bulkCreateVisits([visit as VisitDto]);
    if (response.created === 1) {
      // Return a placeholder ID since the bulk API doesn't return individual IDs
      return 1;
    }
    throw new Error(response.errors?.[0] || 'Failed to create visit');
  }

  // Attendance Request APIs
  async getAttendanceRequestsPaginated(
    page: number = 0, 
    size: number = 10, 
    sortBy: string = 'requestDate', 
    sortDir: string = 'desc'
  ): Promise<AttendanceRequestPageResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sortBy', sortBy);
    params.append('sortDir', sortDir);
    return this.makeRequest<AttendanceRequestPageResponse>(`/request/getAllPaginated?${params.toString()}`);
  }

  async getAttendanceRequestsByStatusPaginated(
    status: string,
    page: number = 0, 
    size: number = 10, 
    sortBy: string = 'requestDate', 
    sortDir: string = 'desc'
  ): Promise<AttendanceRequestPageResponse> {
    const params = new URLSearchParams();
    params.append('status', status);
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sortBy', sortBy);
    params.append('sortDir', sortDir);
    return this.makeRequest<AttendanceRequestPageResponse>(`/request/getByStatusPaginated?${params.toString()}`);
  }

  async getAttendanceRequestsByFiltersPaginated(
    filters: {
      status?: string;
      startDate?: string;
      endDate?: string;
      employeeName?: string;
    },
    page: number = 0, 
    size: number = 10, 
    sortBy: string = 'requestDate', 
    sortDir: string = 'desc'
  ): Promise<AttendanceRequestPageResponse> {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.employeeName) params.append('employeeName', filters.employeeName);
    params.append('page', page.toString());
    params.append('size', size.toString());
    params.append('sortBy', sortBy);
    params.append('sortDir', sortDir);
    return this.makeRequest<AttendanceRequestPageResponse>(`/request/getByFiltersPaginated?${params.toString()}`);
  }

}


export const apiService = new API();
