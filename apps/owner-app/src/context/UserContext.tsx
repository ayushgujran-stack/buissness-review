import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db, auth } from '../../firebase';

export type UserRole = 'owner' | 'manager' | null;

type UserContextType = {
  role: UserRole;
  brandId: string | null;
  branchId: string | null;
  setRole: (role: UserRole) => Promise<void>;
  setBrandId: (id: string) => Promise<void>;
  setBranchId: (id: string) => Promise<void>;
  loading: boolean;
};

const UserContext = createContext<UserContextType>({
  role: null,
  brandId: null,
  branchId: null,
  setRole: async () => {},
  setBrandId: async () => {},
  setBranchId: async () => {},
  loading: true
});

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>(null);
  const [brandId, setBrandIdState] = useState<string | null>(null);
  const [branchId, setBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes to re-subscribe to the correct user document
    const authUnsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        setRoleState(null);
        setBrandIdState(null);
        setBranchIdState(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      const unsubscribeUser = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRoleState(data.role || null);
          setBrandIdState(data.brandId || null);
          setBranchIdState(data.branchId || null);
        } else {
          setRoleState(null);
          setBrandIdState(null);
          setBranchIdState(null);
        }
        setLoading(false);
      }, (error) => {
        console.error("Error fetching user profile:", error);
        setLoading(false);
      });

      return () => unsubscribeUser();
    });

    return () => authUnsubscribe();
  }, []);

  const updateUserData = async (data: Partial<{ role: UserRole, brandId: string, branchId: string }>) => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    await setDoc(doc(db, 'users', user.uid), data, { merge: true });
  };

  const setRole = (newRole: UserRole) => updateUserData({ role: newRole });
  const setBrandId = (id: string) => updateUserData({ brandId: id });
  const setBranchId = (id: string) => updateUserData({ branchId: id });

  return (
    <UserContext.Provider value={{ role, brandId, branchId, setRole, setBrandId, setBranchId, loading }}>
      {children}
    </UserContext.Provider>
  );
};
