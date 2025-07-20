import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const { role } = useAuth() as any;
  console.log('role in Navbar:', role);
  return (
    <nav className="flex space-x-4 bg-gray-800 p-4 shadow-lg">
      {role === 'teacher' && (
        <a href="/teacher" className="text-gray-300 hover:text-blue-400 font-medium">Teacher Panel</a>
      )}
      {role === 'student' && (
        <>
          <a href="/my-classes" className="text-gray-300 hover:text-blue-400 font-medium">My Classes</a>
          <a href="/join-class" className="text-gray-300 hover:text-blue-400 font-medium">Join Class</a>
        </>
      )}
    </nav>
  );
};

export default Navbar;