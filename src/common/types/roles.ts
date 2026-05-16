export type Role =
  | 'super_admin'
  | 'admin'
  | 'doctor'
  | 'staff'
  | 'recording'
  | 'radiology'
  | 'pharmacy'
  | 'paypoint';
export const RolesList: Role[] = ['super_admin', 'admin', 'doctor', 'staff', 'recording', 'radiology', 'pharmacy', 'paypoint'];
