export function Footer() {
  return (
    <footer className="bg-orange text-white mt-10">
      <div className="max-w-[1400px] mx-auto px-6 py-4 text-xs flex flex-wrap gap-x-4 gap-y-1 justify-center">
        <span className="font-semibold">Keystone Commerce · Liwip Procurement</span>
        <a className="opacity-90 hover:opacity-100" href="mailto:Business@keystonecommerce.in">
          Business@keystonecommerce.in
        </a>
        <span className="opacity-80">|</span>
        <a className="opacity-90 hover:opacity-100" href="https://www.keystonecommerce.in">
          www.keystonecommerce.in
        </a>
        <span className="opacity-80">|</span>
        <span>+91 90369 02903</span>
      </div>
    </footer>
  );
}
