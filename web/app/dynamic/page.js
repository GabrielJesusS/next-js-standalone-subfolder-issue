export const dynamic = 'force-dynamic';

export default function Dynamic() {
  return <p>Dynamic page rendered at {new Date().toISOString()}</p>;
}
