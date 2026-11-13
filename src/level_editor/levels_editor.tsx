import { Palette, RawLevel } from "../types";
import _palette from "../data/palette.json";
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { moveLevel, resizeLevel, setBrick } from "./levels_editor_util";
import { automaticBackgroundColor } from "../pure_functions";
import { levelCodeToRawLevel } from "../level_code_to_raw_level";

const palette = _palette as Palette;

let allLevels = null;

function App() {
  const [editingIndex, setEditingIndex] = useState(0);
  const [selected, setSelected] = useState("W");
  const [applying, setApplying] = useState("");
  const [levels, setLevels] = useState<RawLevel[]>([]);
  useEffect(() => {
    fetch("http://localhost:4400/src/data/levels.json")
      .then((r) => r.json())
      .then((lvls) => {
        const cleaned = lvls.map((l) => ({
          name: l.name.trim(),
          size: l.size,
          bricks: (l.bricks + "_".repeat(l.size * l.size)).slice(
            0,
            l.size * l.size,
          ),
          credit: l.credit?.trim() || "",
          category: l.category?.trim() || "",
          author: l.author?.trim() || "",
        }));
        const sorted = [
          ...cleaned
            .filter((l) => l.name.match("icon:"))
            .sort((a, b) => (a.name > b.name ? 1 : -1)),
          ...cleaned.filter((l) => !l.name.match("icon:")),
        ];
        setLevels(sorted as RawLevel[]);
        allLevels = sorted;
      });
  }, []);

  const updateLevel = (index: number, change: Partial<RawLevel>) => {
    setLevels((list: RawLevel[]) =>
      list.map((l, li) => (li === index ? { ...l, ...change } : l)),
    );
  };

  const deleteLevel = (index: number) => {
    if (confirm("Delete level")) {
      setLevels(levels.filter((l, i) => i !== index));
    }
  };
  useEffect(() => {
    if (!allLevels || JSON.stringify(allLevels) === JSON.stringify(levels))
      return;
    const timoutId = setTimeout(() => {
      return fetch("http://localhost:4400/src/data/levels.json", {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify(levels, null, 2),
      });
    }, 500);
    return () => clearTimeout(timoutId);
  }, [levels]);

  const level = levels[editingIndex];

  const content = (() => {
    if (!level) return null;
    const { name, credit, bricks, size, category, author } = level;

    const brickButtons = [];
    for (let x = 0; x < size; x++) {
      for (let y = 0; y < size; y++) {
        const index = y * size + x;
        brickButtons.push(
          <button
            key={index}
            onMouseDown={() => {
              if (!applying) {
                const color = selected === bricks[index] ? "_" : selected;
                setApplying(color);
                updateLevel(editingIndex, setBrick(level, index, color));
              }
            }}
            onMouseEnter={() => {
              if (applying) {
                updateLevel(editingIndex, setBrick(level, index, applying));
              }
            }}
            style={{
              background: palette[bricks[index]] || "transparent",
              left: x * 40,
              top: y * 40,
              width: 40,
              height: 40,
              position: "absolute",
            }}
          >
            {(palette[bricks[index]] == "black" && "💣") || " "}
          </button>,
        );
      }
    }

    return (
      <>
        <input
          id={"name"}
          type="text"
          value={name}
          onChange={(e) => updateLevel(editingIndex, { name: e.target.value })}
        />
        <div id="credit">
          <input
            placeholder="credit"
            type="text"
            value={credit || ""}
            onChange={(e) =>
              updateLevel(editingIndex, { credit: e.target.value })
            }
          />

          <input
            list="existing-categories"
            placeholder="category"
            type="text"
            value={category || ""}
            onChange={(e) =>
              updateLevel(editingIndex, { category: e.target.value })
            }
          />

          <input
            placeholder="author"
            list="existing-authors"
            type="text"
            value={author || ""}
            onChange={(e) =>
              updateLevel(editingIndex, { author: e.target.value })
            }
          />
        </div>

        <div id={"tools"}>
          <button onClick={() => deleteLevel(editingIndex)}>Delete</button>
          <button
            onClick={() => updateLevel(editingIndex, resizeLevel(level, -1))}
          >
            -
          </button>
          <button
            onClick={() => updateLevel(editingIndex, resizeLevel(level, +1))}
          >
            +
          </button>
          <button
            onClick={() => updateLevel(editingIndex, moveLevel(level, -1, 0))}
          >
            L
          </button>
          <button
            onClick={() => updateLevel(editingIndex, moveLevel(level, 1, 0))}
          >
            R
          </button>
          <button
            onClick={() => updateLevel(editingIndex, moveLevel(level, 0, -1))}
          >
            U
          </button>
          <button
            onClick={() => updateLevel(editingIndex, moveLevel(level, 0, 1))}
          >
            D
          </button>
        </div>

        <div id="bricks">
          <div
            id="level-bricks-preview"
            style={{
              width: size * 40,
              height: size * 40,
              background: automaticBackgroundColor(bricks.split("")),
            }}
          >
            {brickButtons}
          </div>
        </div>
      </>
    );
  })();

  return (
    <div
      id={"editor"}
      onMouseUp={() => {
        setApplying("");
      }}
    >
      <div id="list">
        {levels.map((level, li) => (
          <button
            key={li}
            className={li === editingIndex ? "active" : ""}
            onClick={() => setEditingIndex(li)}
          >
            {level.name} {level.author ? "✍️" : ""} {level.category ? "🗄️" : ""}
          </button>
        ))}
      </div>
      <>{content}</>
      <div id={"palette"}>
        {Object.entries(palette).map(([code, color]) => (
          <button
            key={code}
            className={code === selected ? "active" : ""}
            style={{
              background: color || "",
              display: "inline-block",
              width: "40px",
              height: "40px",
              border: "1px solid black",
            }}
            onClick={() => setSelected(code)}
          >
            {(color == "" && "x") || (color == "black" && "💣") || " "}
          </button>
        ))}
      </div>
      <div id={"new"}>
        <button
          id="new-level"
          onClick={() => {
            const name = prompt("Name ? ");
            if (!name) return;

            setEditingIndex(levels.length);
            setLevels((l) => [
              ...l,
              {
                name,
                size: 8,
                bricks:
                  "________________________________________________________________",
                svg: null,
                color: "",
              },
            ]);
          }}
        >
          new
        </button>
        <button
          id="import-level"
          onClick={() => {
            const code = prompt("Level Code ? ");
            if (!code) return;
            const l = levelCodeToRawLevel(code);
            if (!l) return;
            setLevels((list) => [...list.filter((e) => e.name !== l.name), l]);
            setEditingIndex(levels.length);
          }}
        >
          import
        </button>
      </div>

      <datalist id="existing-categories">
        {[
          ...new Set(
            levels
              .filter((l, li) => li !== editingIndex)
              .map((l) => l.category),
          ),
        ]
          .filter(Boolean)
          .map((o) => (
            <option value={o} key={o}></option>
          ))}
      </datalist>
      <datalist id="existing-authors">
        {[
          ...new Set(
            levels.filter((l, li) => li !== editingIndex).map((l) => l.author),
          ),
        ]
          .filter(Boolean)
          .map((o) => (
            <option value={o} key={o}></option>
          ))}
      </datalist>
    </div>
  );
}

const root = createRoot(document.getElementById("app") as HTMLDivElement);
root.render(<App />);
