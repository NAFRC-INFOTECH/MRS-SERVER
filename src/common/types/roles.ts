export type Role =
  | 'super_admin'
  | 'admin'
  | 'doctor'
  | 'nurse'
  | 'recording'
  | 'pharmacy'
  | 'paypoint';
export const RolesList: Role[] = ['super_admin', 'admin', 'doctor', 'nurse', 'recording', 'pharmacy', 'paypoint'];
