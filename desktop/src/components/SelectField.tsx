import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SELECT_SEPARATOR, type SelectMenuItem } from "../lib/constants";

type Props = {
  value: string;
  options: readonly SelectMenuItem[];
  onChange: (value: string) => void;
};

function optionMatchesQuery(option: string, query: string) {
  return option.toLowerCase().includes(query.trim().toLowerCase());
}

export function SelectField({ value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const selectableOptions = useMemo(
    () => options.filter((option): option is string => option !== SELECT_SEPARATOR),
    [options],
  );

  const displayItems = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return options;
    return selectableOptions.filter((option) => optionMatchesQuery(option, trimmed));
  }, [options, query, selectableOptions]);

  const navigableOptions = useMemo(
    () => displayItems.filter((option): option is string => option !== SELECT_SEPARATOR),
    [displayItems],
  );

  const closeDropdown = () => {
    setOpen(false);
    setQuery("");
    setHighlightIndex(0);
  };

  const selectOption = (option: string) => {
    onChange(option);
    closeDropdown();
  };

  const openDropdown = () => {
    setOpen(true);
    setQuery("");
    setHighlightIndex(0);
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setHighlightIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const highlighted = listRef.current.querySelector(".is-highlighted");
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open, displayItems]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightIndex((current) => Math.min(current + 1, navigableOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const trimmed = query.trim();
      const exactMatch = navigableOptions.find(
        (option) => option.toLowerCase() === trimmed.toLowerCase(),
      );
      const highlighted = navigableOptions[highlightIndex];
      if (exactMatch) {
        selectOption(exactMatch);
      } else if (highlighted) {
        selectOption(highlighted);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeDropdown();
    }
  };

  const highlightedValue = navigableOptions[highlightIndex] ?? value;

  return (
    <div ref={rootRef} className={`ic-select-wrap${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ic-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? closeDropdown() : openDropdown())}
      >
        <span className="ic-select-value">{value}</span>
      </button>

      {open ? (
        <div className="ic-select-panel">
          <input
            ref={searchRef}
            type="text"
            className="ic-select-search"
            value={query}
            placeholder="Search..."
            aria-label="Search options"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
          />
          <ul
            ref={listRef}
            id={listId}
            className="ic-select-menu"
            role="listbox"
            aria-activedescendant={`${listId}-${highlightedValue}`}
          >
            {navigableOptions.length === 0 ? (
              <li className="ic-select-empty" aria-hidden>
                No matches
              </li>
            ) : (
              displayItems.map((option, index) => {
                if (option === SELECT_SEPARATOR) {
                  return (
                    <li key={`separator-${index}`} role="separator" className="ic-select-separator" aria-hidden />
                  );
                }

                const selected = option === value;
                const highlighted = option === navigableOptions[highlightIndex];
                return (
                  <li key={option} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-${option}`}
                      role="option"
                      aria-selected={selected}
                      className={`ic-select-option${selected ? " is-selected" : ""}${highlighted ? " is-highlighted" : ""}`}
                      onMouseEnter={() => {
                        const nextIndex = navigableOptions.indexOf(option);
                        if (nextIndex >= 0) setHighlightIndex(nextIndex);
                      }}
                      onClick={() => selectOption(option)}
                    >
                      {option}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
