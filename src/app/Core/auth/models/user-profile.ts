export type UserRole = 'Administrador' | 'Profesor' | 'Estudiante' | 'Invitado';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
}
