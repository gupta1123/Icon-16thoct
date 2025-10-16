# Role Hierarchy Implementation

## Overview
This document defines the complete role hierarchy system for the sales management application. The hierarchy establishes clear levels of authority and access permissions throughout the organization.

## Role Hierarchy

### **Primary Hierarchy**
```
Admin (Highest Authority)
    ↓
Data Manager
    ↓
Coordinator
    ↓
Regional Manager
    ↓
Field Officer (Lowest Authority)
```

### **Specialized Role**
```
HR (Separate from main hierarchy - specialized role)
```

## Role Definitions

### 1. **Admin** (ROLE_ADMIN)
- **Level**: 1 (Highest Authority)
- **Description**: Complete system administration and management
- **Responsibilities**:
  - Full system access and control
  - User management and role assignment
  - System configuration and settings
  - Data oversight and security
  - All operational permissions

### 2. **Data Manager** (ROLE_DATA_MANAGER)
- **Level**: 2
- **Description**: Data management and analytics with full access
- **Responsibilities**:
  - Complete data access and export capabilities
  - System-wide reporting and analytics
  - Data backup and recovery
  - HR functions access
  - System settings access
  - All operational permissions except user management

### 3. **Coordinator** (ROLE_COORDINATOR)
- **Level**: 3
- **Description**: Team coordination and management
- **Responsibilities**:
  - Team coordination and oversight
  - Employee management (except HR functions)
  - Customer and visit management
  - Reports and analytics access
  - Expense management
  - Approval workflows

### 4. **Regional Manager** (ROLE_MANAGER / ROLE_OFFICE MANAGER)
- **Level**: 4
- **Description**: Regional team management and oversight
- **Responsibilities**:
  - Regional team oversight
  - Limited employee management
  - Customer and visit tracking
  - Basic reporting access
  - Expense tracking
  - Limited approval permissions

### 5. **Field Officer** (ROLE_FIELD OFFICER)
- **Level**: 5 (Lowest Authority)
- **Description**: Field operations and customer interaction
- **Responsibilities**:
  - Customer visits and interactions
  - Basic data entry
  - Expense reporting
  - Limited self-service features
  - No management permissions

### 6. **HR** (ROLE_HR)
- **Level**: Specialized (Outside main hierarchy)
- **Description**: Human Resources management
- **Responsibilities**:
  - Employee salary management
  - HR attendance tracking
  - HR policy configuration
  - Restricted to HR-specific functions only

## Access Control Matrix

| Feature | Admin | Data Manager | Coordinator | Regional Manager | Field Officer | HR |
|---------|-------|--------------|-------------|------------------|---------------|-----|
| **System Settings** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **User Management** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Data Export** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **HR Management** | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ (Limited) |
| **Employee Management** | ✅ | ✅ | ✅ | ⚠️ (Limited) | ❌ | ❌ |
| **Customer Management** | ✅ | ✅ | ✅ | ✅ | ⚠️ (Self) | ❌ |
| **Visit Tracking** | ✅ | ✅ | ✅ | ✅ | ⚠️ (Self) | ❌ |
| **Expense Management** | ✅ | ✅ | ✅ | ⚠️ (Team) | ⚠️ (Self) | ❌ |
| **Reports & Analytics** | ✅ | ✅ | ✅ | ⚠️ (Basic) | ❌ | ❌ |
| **Approvals** | ✅ | ✅ | ✅ | ⚠️ (Limited) | ❌ | ❌ |
| **Live Locations** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

**Legend:**
- ✅ Full Access
- ⚠️ Limited Access
- ❌ No Access

## Technical Implementation

### 1. **Role Detection Logic**
```typescript
// Role hierarchy detection
const isAdmin = userRole === 'ADMIN' || currentUser?.authorities?.some(auth => auth.authority === 'ROLE_ADMIN');
const isDataManager = userRole === 'DATA_MANAGER' || currentUser?.authorities?.some(auth => auth.authority === 'ROLE_DATA_MANAGER');
const isCoordinator = userRole === 'COORDINATOR' || currentUser?.authorities?.some(auth => auth.authority === 'ROLE_COORDINATOR');
const isManager = userRole === 'MANAGER' || userRole === 'OFFICE MANAGER' || 
                 currentUser?.authorities?.some(auth => auth.authority === 'ROLE_MANAGER' || auth.authority === 'ROLE_OFFICE MANAGER');
const isFieldOfficer = userRole === 'FIELD OFFICER' || currentUser?.authorities?.some(auth => auth.authority === 'ROLE_FIELD OFFICER');
const isHR = userRole === 'HR' || currentUser?.authorities?.some(auth => auth.authority === 'ROLE_HR');
```

### 2. **Navigation Access Control**
```typescript
// Settings access - Admin and Data Manager only
{(isAdmin || isDataManager) && (
  <SettingsLink />
)}

// HR access - Admin, Data Manager, and HR only
{(isAdmin || isDataManager || isHR) && (
  <HRLink />
)}
```

### 3. **Role Display Priority**
```typescript
const getDisplayRole = () => {
  if (isAdmin) return 'Admin';
  if (isDataManager) return 'Data Manager';
  if (isCoordinator) return 'Coordinator';
  if (isManager) return 'Regional Manager';
  if (isFieldOfficer) return 'Field Officer';
  if (isHR) return 'HR';
  return 'User';
};
```

## Permission Levels

### **Level 1 - Admin Permissions**
- Complete system control
- User and role management
- All data access and export
- System configuration
- Security management

### **Level 2 - Data Manager Permissions**
- Full data access and export
- HR function access
- System settings access
- Analytics and reporting
- Data backup capabilities

### **Level 3 - Coordinator Permissions**
- Team management
- Employee oversight
- Customer and visit management
- Report generation
- Approval workflows

### **Level 4 - Regional Manager Permissions**
- Regional team oversight
- Limited employee management
- Customer tracking
- Basic reporting
- Team expense tracking

### **Level 5 - Field Officer Permissions**
- Customer interactions
- Visit logging
- Personal expense reporting
- Basic self-service features

### **Specialized - HR Permissions**
- Salary management
- HR attendance tracking
- HR policy configuration
- Employee HR data access

## Navigation Structure by Role

### **Admin Navigation**
```
Dashboard
├── All Sales & Marketing Features
├── Complete Employee Management
├── Full Reports & Analytics
├── HR Management
└── System Settings
```

### **Data Manager Navigation**
```
Dashboard
├── All Sales & Marketing Features
├── Complete Employee Management
├── Full Reports & Analytics
├── HR Management
└── System Settings
```

### **Coordinator Navigation**
```
Dashboard
├── Sales & Marketing (Full)
├── Employee Management (Full)
├── Reports & Analytics (Full)
└── Live Locations
```

### **Regional Manager Navigation**
```
Dashboard
├── Sales & Marketing (Limited)
├── Employee Management (Limited)
├── Reports (Basic)
└── Live Locations
```

### **Field Officer Navigation**
```
Dashboard
├── Customers (Self)
├── Visits (Self)
├── Expenses (Self)
└── Basic Reports
```

### **HR Navigation**
```
HR Dashboard
├── Salary Management
├── HR Attendance
└── HR Settings
```

## Role Assignment

### **Backend Role Configuration**
```json
{
  "username": "admin",
  "password": "password",
  "roles": "ADMIN"
}

{
  "username": "datamanager",
  "password": "password",
  "roles": "DATA_MANAGER"
}

{
  "username": "coordinator",
  "password": "password",
  "roles": "COORDINATOR"
}

{
  "username": "manager",
  "password": "password",
  "roles": "MANAGER"
}

{
  "username": "fieldofficer",
  "password": "password",
  "roles": "FIELD OFFICER"
}

{
  "username": "hr",
  "password": "password",
  "roles": "HR"
}
```

## Security Considerations

### **Role-Based Access Control (RBAC)**
- Server-side role validation
- JWT token authority verification
- UI component access control
- API endpoint protection

### **Data Protection**
- Role-based data filtering
- Sensitive information protection
- Audit logging by role
- Permission escalation prevention

### **Session Management**
- Role-based session timeout
- Authority validation on each request
- Secure logout procedures
- Token refresh with role verification

## Testing the Hierarchy

### **Role Assignment Testing**
1. Assign each role to test users
2. Verify role detection in frontend
3. Test navigation access control
4. Validate permission restrictions

### **Access Control Testing**
1. Test settings access (Admin/Data Manager only)
2. Verify HR access restrictions
3. Test employee management permissions
4. Validate data export capabilities

### **Navigation Testing**
1. Verify role-specific navigation
2. Test mobile navigation
3. Check dropdown menu access
4. Validate page redirects

## Future Enhancements

### **Advanced Role Management**
- Role inheritance
- Custom permission sets
- Temporary role elevation
- Role-based notifications

### **Audit and Compliance**
- Role change tracking
- Permission usage analytics
- Compliance reporting
- Security audit logs

### **Dynamic Role Assignment**
- Self-service role requests
- Manager approval workflows
- Temporary role assignments
- Role expiration management

## Troubleshooting

### **Common Issues**

1. **Access Denied Errors**
   - Verify user role assignment
   - Check JWT token authorities
   - Validate role detection logic

2. **Navigation Issues**
   - Clear browser cache
   - Check role state management
   - Verify component updates

3. **Permission Problems**
   - Review role hierarchy logic
   - Check access control conditions
   - Validate backend permissions

### **Role Debugging**
```typescript
// Debug role detection
console.log('User Role:', userRole);
console.log('Authorities:', currentUser?.authorities);
console.log('Is Admin:', isAdmin);
console.log('Is Data Manager:', isDataManager);
console.log('Is Coordinator:', isCoordinator);
console.log('Is Manager:', isManager);
console.log('Is Field Officer:', isFieldOfficer);
console.log('Is HR:', isHR);
```

## Summary

The role hierarchy system provides:

- **Clear Authority Structure**: Admin > Data Manager > Coordinator > Regional Manager > Field Officer
- **Specialized HR Role**: Separate from main hierarchy with focused responsibilities
- **Granular Permissions**: Role-based access control for all features
- **Secure Implementation**: Server-side validation and client-side UI control
- **Scalable Design**: Easy to add new roles and permissions
- **Comprehensive Testing**: Full coverage of role-based functionality

This hierarchy ensures proper organizational structure while maintaining security and operational efficiency across all user roles.
