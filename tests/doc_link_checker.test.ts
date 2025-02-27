/**
 * Doc Link Checker
 *
 * We define here a test to make sure that there are no dead link in the Owl
 * documentation.
 */
import * as fs from "fs";

const LINK_REGEXP = /\[([^\[]+)\]\(([^\)]+)\)/g;
const HEADING_REGEXP = /\n(#+\s*)(.*)/g;

// files to be checked
function getFiles(): string[] {
  const DOCFILES = fs.readdirSync("doc").map(f => `doc/${f}`);
  const MAINREADME = "README.md";
  DOCFILES.push('roadmap.md', MAINREADME)
  return DOCFILES;
}

test("All markdown links work", () => {
  let linkNumber = 0;
  let invalidLinkNumber = 0;
  const files = getFiles();
  const data = readDocData(files);
  for (let file of data) {
    for (let link of file.links) {
      // DEBUG: uncomment next line
      // console.warn(`Checking "${link.name}" in "${file.name}"`);
      linkNumber++;
      if (!isLinkValid(link, file, data)) {
        console.warn(`Invalid Link: "${link.name}" in "${file.name}"`);
        invalidLinkNumber++;
      }
    }
  }
  expect(invalidLinkNumber).toBe(0);
  expect(linkNumber).toBeGreaterThan(10);
});

interface MarkDownLink {
  name: string;
  link: string;
}

interface MarkDownSection {
  name: string;
  slug: string;
}

interface FileData {
  name: string;
  links: MarkDownLink[];
  sections: MarkDownSection[];
}

function isLinkValid(link: MarkDownLink, current: FileData, files: FileData[]): boolean {
  if (link.link.startsWith('http')) {
    // no check on external links
    return true;
  }
  const parts = link.link.split("#");
  const currentParts = current.name.split("/");
  const path = currentParts.length > 1 ? currentParts[0] + "/" : "";
  const fullName = path + parts[0];
  if (parts.length === 1) {
    // no # in url
    if (parts[0].endsWith(".md")) {
      // it is a local md file
      if (!files.find(f => f.name === fullName)) {
        return false;
      }
    }
  } else {
    const file = parts[0] === "" ? current : files.find(f => f.name === fullName);
    if (!file) {
      return false;
    }
    if (!file.sections.find(s => s.slug === parts[1])) {
      return false;
    }
  }
  return true;
}
// adapted from https://medium.com/@mhagemann/the-ultimate-way-to-slugify-a-url-string-in-javascript-b8e4a0d849e1
function slugify(str) {
  const a = "àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·_,:;";
  const b = "aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz-----";
  const p = new RegExp(a.split("").join("|"), "g");
  return str
    .toString()
    .toLowerCase()
    .replace(/\//g, "") // remove /
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, "-and-") // Replace & with ‘and’
    .replace(/[^\w\-]+/g, "") // Remove all non-word characters
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

function readDocData(files: string[]): FileData[] {
  const result: FileData[] = [];

  for (let file of files) {
    const fileData: FileData = {
      name: file,
      links: [],
      sections: []
    };
    const content = fs.readFileSync(file, { encoding: "utf8" });
    let m;
    // get links info
    do {
      m = LINK_REGEXP.exec(content);
      if (m) {
        fileData.links.push({ name: m[0], link: m[2] });
      }
    } while (m);
    // get sections info
    do {
      m = HEADING_REGEXP.exec(content);
      if (m) {
        fileData.sections.push({ name: m[0], slug: slugify(m[2]) });
      }
    } while (m);

    result.push(fileData);
  }
  return result;
}
