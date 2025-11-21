import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Text } from '@forge/react';
import { callBackend } from "./index";

const App = () => {
  const [data] = useState(null);
  useEffect(() => {
    const result = callBackend('writeText', { example: 'Hello from frontend!' });
  }, []);

  return (
    <>
      <Text>Hello world!</Text>
      <Text>{data ? data : 'Loading...'}</Text>
    </>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
