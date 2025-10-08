// Update this page (the content is just a fallback if you fail to update the page)

const Index = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold mb-4">Coffee App</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Sistema de gestión de Cafetería
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/admin/login"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            Panel Administrativo
          </a>
        </div>
      </div>
    </div>
  );
};

export default Index;
