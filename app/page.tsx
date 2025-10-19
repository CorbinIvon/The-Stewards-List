export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          The Stewards List
        </h1>
        <p className="text-center text-lg mb-4">
          A home organization app featuring user management, task management, and task tracking.
        </p>
        <div className="mt-8 p-6 bg-gray-100 rounded-lg">
          <h2 className="text-2xl font-semibold mb-4">Features</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>User Management - Create and manage user accounts</li>
            <li>Task Management - Create, assign, and track tasks</li>
            <li>Task Logging - Track task completion history</li>
            <li>Permissions - Control access to tasks</li>
            <li>Chat - Communicate with team members</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
