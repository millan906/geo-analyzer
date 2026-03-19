interface SubmitButtonProps {
  isLoading: boolean;
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'submit' | 'button';
}

export function SubmitButton({
  isLoading,
  label,
  loadingLabel = 'Analyzing…',
  disabled,
  onClick,
  type = 'button',
}: SubmitButtonProps) {
  const isDisabled = isLoading || disabled;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-sm ${
        isDisabled
          ? 'bg-indigo-400 cursor-not-allowed'
          : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md active:scale-95'
      }`}
    >
      {isLoading ? (
        <>
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
            aria-hidden="true"
          />
          <span>{loadingLabel}</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
