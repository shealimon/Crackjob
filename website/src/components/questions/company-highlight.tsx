export function CompanyHighlight({ name }: { name: string }) {
  return (
    <span className="mx-0.5 inline rounded-md bg-[#FFF3B0] px-1.5 py-0.5 font-semibold text-black">
      @{name}
    </span>
  );
}
