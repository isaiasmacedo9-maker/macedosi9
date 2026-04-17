import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ALL_CLIENTS_PORTAL_ID, getAccessiblePortalClients } from '../../dev/clientPortalData';

const ClientPortalEntry = () => {
  const { user } = useAuth();
  const accessibleClients = getAccessiblePortalClients(user);

  if (!accessibleClients.length) {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to={`/cliente/${ALL_CLIENTS_PORTAL_ID}`} replace />;
};

export default ClientPortalEntry;
