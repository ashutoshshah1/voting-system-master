import { Link } from "react-router-dom";
import { Button } from "../components/Button";
import { PageHeader } from "../components/PageHeader";

export function NotFound() {
  return (
    <section className="space-y-6">
      <PageHeader
        kicker="404"
        title="Page not found"
        subtitle="The page you are looking for does not exist."
      />
      <Link to="/">
        <Button>Return home</Button>
      </Link>
    </section>
  );
}
