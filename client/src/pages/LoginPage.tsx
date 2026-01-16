import React from 'react';

const LoginPage: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-900">Sign In</h2>
        <p className="text-center text-gray-600">
          This is a placeholder for the custom sign-in page.
        </p>
        <div className="flex flex-col space-y-4">
          <button
            onClick={() => window.location.href = '/login/replit'}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Sign in with Replit (temp)
          </button>
          <p className="text-xs text-center text-gray-500">
            (This will be replaced with our own auth system)
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
