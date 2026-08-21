import Image from "next/image";
import signatureImage from "@/assets/documents/vlingo-authorized-signature.png";
import stampImage from "@/assets/documents/vlingo-official-stamp.png";

function currentLagosDate() {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    timeZone: "Africa/Lagos",
    year: "numeric",
  }).format(new Date());
}

export function AuthorizedDocumentSignature() {
  return (
    <div className="document-authorization ml-auto w-full max-w-64 text-center">
      <div className="relative mx-auto h-24 w-64">
        <Image
          alt="Vlingo authorised signature"
          className="absolute bottom-0 left-0 z-10 h-20 w-44 object-contain"
          priority
          src={signatureImage}
        />
        <Image
          alt="Vlingo Systems official stamp"
          className="absolute right-1 top-0 h-24 w-24 object-contain opacity-90"
          priority
          src={stampImage}
        />
      </div>
      <div className="border-t border-[#151915] pt-1 text-[10px]">
        <p className="font-semibold">Authorised Signatory</p>
        <p className="mt-0.5 text-[#5e665e]">Date: {currentLagosDate()}</p>
      </div>
    </div>
  );
}
