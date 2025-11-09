const generateUniqueId = (role) => {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  const rolePrefix = {
    parent: 'PAR',
    therapist: 'THR',
    teacher: 'TEA',
    researcher: 'RES',
    admin: 'ADM'
  };

  const prefix = rolePrefix[role] || role.substring(0, 3).toUpperCase();
  return `${prefix}-${timestamp}-${randomPart}`;
};

module.exports = { generateUniqueId };
