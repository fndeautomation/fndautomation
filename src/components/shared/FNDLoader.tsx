export default function FNDLoader({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-50">
      <div className="flex flex-col items-center gap-6">
        <div className="animate-fnd-pulse">
          <img
            src="/assets/images/Gemini_Generated_Image_dx05judx05judx05.png"
            alt="FND"
            className="h-20 w-20 object-contain"
          />
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-primary tracking-widest mb-1">FND</div>
          <div className="text-xs text-muted-foreground tracking-wider uppercase">
            {message ?? 'Loading…'}
          </div>
        </div>
        <div className="w-40 h-1 bg-border rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-fnd-progress" />
        </div>
      </div>
    </div>
  );
}
