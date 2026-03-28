import React from 'react';

export interface DashboardProps {
  title: string;
  userId: string;
  showStats: boolean;
}

export function Dashboard(props: DashboardProps): React.ReactElement {
  const { title, userId, showStats } = props;

  return (
    <div className="dashboard">
      <h1>{title}</h1>
      <p>User: {userId}</p>
      {showStats && <div className="stats">Stats panel</div>}
    </div>
  );
}

export default Dashboard;
