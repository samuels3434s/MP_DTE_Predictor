import os
import re
import json
from pypdf import PdfReader

def split_combined_ranks(rank_str):
    n = len(rank_str)
    if n < 2:
        return None
    mid = n // 2
    candidates = []
    for offset in [0, -1, 1, -2, 2, -3, 3, -4, 4]:
        k = mid + offset
        if 1 <= k < n:
            op_part = rank_str[:k]
            cl_part = rank_str[k:]
            if (len(op_part) > 1 and op_part[0] == '0') or (len(cl_part) > 1 and cl_part[0] == '0'):
                continue
            try:
                op = int(op_part)
                cl = int(cl_part)
                if op <= cl:
                    score = abs(len(op_part) - len(cl_part))
                    candidates.append((score, op, cl))
            except ValueError:
                continue
    if candidates:
        candidates.sort(key=lambda x: x[0])
        return candidates[0][1], candidates[0][2]
    return None

def is_header_footer(line):
    line_upper = line.upper()
    keywords = [
        "DIRECTORATE OF TECHNICAL EDUCATION",
        "BACHELOR OF TECHNOLOGY",
        "OPENING CLOSING RANK",
        "OPENING AND CLOSING RANK",
        "DATE:",
        "PAGE ",
        "S. NO.",
        "INSTITUTE NAME",
        "INSTITUTE TYPE",
        "ALLOTTED CATEGORY",
        "TOTAL ALLOTTED",
        "BASED ON JEE",
        "INTERNAL BRANCH CHANGE",
        "MADHYA PRADESH"
    ]
    for kw in keywords:
        if kw in line_upper:
            return True
            
    words = line_upper.split()
    if not words:
        return True
        
    header_vocab = {
        "FW", "BRANCH", "NATIONALPLAYER", "DOMICILE", "RANK", "CATEGORY", 
        "ALLOTTED", "TOTAL", "OPENING", "CLOSING", "ELIGIBLE", "EXAM", 
        "REMARKS", "JEE", "COMMON", "S.", "NO.", "INSTITUTE", "NAME", "TYPE",
        "FIRST", "SECOND", "ROUND", "UPGRADE", "MERIT"
    }
    
    if all(w in header_vocab or w.replace(".", "") in header_vocab for w in words):
        return True
        
    if line.strip().startswith("*"):
        return True
        
    return False

def parse_record_line(line, file_type):
    # Preprocessing to split merged tokens
    # 1. Replace hyphen followed by space with just hyphen
    line = line.replace('- ', '-')
    
    # 2. Insert spaces around institute types
    line = re.sub(r'(private|govt|aided|s\.f\.i\.)', r' \1 ', line, flags=re.IGNORECASE)
    
    # 3. Insert spaces around exam types
    line = re.sub(r'(ENTRANCE|QUALIFYING)', r' \1 ', line, flags=re.IGNORECASE)
    
    # 4. Replace NO CHANGE with NO_CHANGE for remarks handling
    line = re.sub(r'NO\s+CHANGE', 'NO_CHANGE', line, flags=re.IGNORECASE)
    
    # 5. Separate total allotted and remarks (e.g. 11CHANGE -> 11 CHANGE)
    line = re.sub(r'(\d+)(CHANGE|NO_CHANGE|NO|NOCHANGE)\b', r'\1 \2', line, flags=re.IGNORECASE)
    
    # 6. Separate category and domicile (e.g. UR/X/OPY -> UR/X/OP Y)
    line = re.sub(r'\b([A-Z0-9]+/[A-Z0-9/]+)([YN])\b', r'\1 \2', line)
    
    # 7. Separate merged categories (e.g. OBC/NCC/MOBC/X/OP -> OBC/NCC/M OBC/X/OP)
    line = re.sub(r'\b([A-Z0-9]+/[A-Z0-9/]+/[A-Z])(UR|OBC|SC|ST|EWS|FW|JKM)\b', r'\1 \2', line)
    
    # 8. Separate ranks from categories (e.g. 718830718830EWS/X/M -> 718830718830 EWS/X/M)
    line = re.sub(r'(\d+)([A-Z][A-Z0-9]*/[A-Z0-9/]+)', r'\1 \2', line)
    line = re.sub(r'(\d+)(EWS|JKM|FW/OP|TFW)\b', r'\1 \2', line)
    
    tokens = line.split()
    if not tokens:
        return None
        
    if not tokens[0].isdigit():
        return None
        
    s_no = int(tokens[0])
    ptr = len(tokens) - 1
    
    # --- Remarks (File Type 3 only) ---
    remarks = None
    if file_type == 3:
        if ptr >= 0 and tokens[ptr] in ['CHANGE', 'NO_CHANGE']:
            remarks = tokens[ptr].replace('NO_CHANGE', 'NO CHANGE')
            ptr -= 1
            
    # --- Total Allotted ---
    if ptr >= 0 and tokens[ptr].isdigit():
        total_allotted = int(tokens[ptr])
        ptr -= 1
    else:
        return {"error": f"Missing total allotted. Token at ptr is: {tokens[ptr] if ptr >= 0 else 'None'}"}
        
    # --- Domicile ---
    domicile = "MP"  # default
    if ptr >= 0 and tokens[ptr] in ["AI", "Y", "N"]:
        domicile = "AI" if tokens[ptr] == "AI" else "MP"
        ptr -= 1
        
    # --- Allotted Category ---
    if ptr >= 0:
        allotted_cat = tokens[ptr]
        ptr -= 1
    else:
        return {"error": "Missing allotted category"}
        
    # --- Eligible Category (File Types 2 and 3 only) ---
    eligible_cat = None
    if file_type in [2, 3]:
        if ptr >= 0:
            eligible_cat = tokens[ptr]
            ptr -= 1
        else:
            return {"error": "Missing eligible category"}
            
    # --- Ranks ---
    op_rank = None
    cl_rank = None
    if ptr >= 0:
        val = tokens[ptr]
        if val.isdigit() and len(val) >= 8:
            res = split_combined_ranks(val)
            if res:
                op_rank, cl_rank = res
                ptr -= 1
            else:
                return {"error": f"Failed to split combined ranks: {val}"}
        else:
            # Two separate ranks
            if ptr >= 1 and tokens[ptr].isdigit() and tokens[ptr-1].isdigit():
                cl_rank = int(tokens[ptr])
                op_rank = int(tokens[ptr-1])
                ptr -= 2
            elif ptr >= 0 and tokens[ptr].isdigit():
                cl_rank = int(tokens[ptr])
                op_rank = cl_rank
                ptr -= 1
            else:
                return {"error": f"Missing ranks. Found token: {val}"}
                
    if op_rank is None or cl_rank is None:
        return {"error": "Missing rank values"}
        
    # --- Exam (File Type 3 only) ---
    exam = None
    if file_type == 3:
        if ptr >= 0 and tokens[ptr] in ['ENTRANCE', 'QUALIFYING']:
            exam = tokens[ptr]
            ptr -= 1
        else:
            return {"error": f"Missing exam type. Found: {tokens[ptr] if ptr >= 0 else 'None'}"}
            
    # Find the Institute Type
    type_idx = -1
    for idx in range(1, len(tokens)):
        clean_tok = tokens[idx].lower().replace('.', '')
        if clean_tok in ['private', 'govt', 'aided', 'sfi']:
            # Verify lookahead: the next token must be Y or N (FW status)
            if idx + 1 < len(tokens) and tokens[idx + 1] in ['Y', 'N']:
                type_idx = idx
                break
            
    if type_idx == -1:
        return {"error": f"Could not identify institute type in tokens: {tokens}"}
        
    inst_type = tokens[type_idx]
    fw = tokens[type_idx + 1]
    
    # Institute Name is everything between S. No and Institute Type
    inst_name = " ".join(tokens[1:type_idx])
    
    # Branch name is everything between FW status and the rank/exam index
    branch_start = type_idx + 2
    branch_end = ptr
    if branch_start <= branch_end:
        branch = " ".join(tokens[branch_start:branch_end+1])
    else:
        return {"error": f"Branch extraction failed. tokens: {tokens}"}
        
    # Standardize exam type name (JEE vs Qualifying 12th)
    exam_str = "JEE"
    if exam == "QUALIFYING":
        exam_str = "QUALIFYING"
        
    return {
        "s_no": s_no,
        "inst_name": inst_name,
        "inst_type": inst_type,
        "fw": fw,
        "branch": branch,
        "exam": exam_str,
        "op_rank": op_rank,
        "cl_rank": cl_rank,
        "eligible_cat": eligible_cat,
        "allotted_cat": allotted_cat,
        "domicile": domicile,
        "total_allotted": total_allotted,
        "remarks": remarks
    }

def process_pdf(path, file_type, round_name):
    reader = PdfReader(path)
    records = []
    buffer_line = ""
    success = 0
    failed = 0
    errors = []
    
    for page_num in range(len(reader.pages)):
        text = reader.pages[page_num].extract_text()
        lines = text.split("\n")
        for line in lines:
            line_str = line.strip()
            if not line_str or is_header_footer(line_str):
                continue
                
            # If the line starts with a serial number, it marks the start of a new record.
            if re.match(r'^\d+\s+[A-Za-z]', line_str):
                if buffer_line:
                    res = parse_record_line(buffer_line, file_type)
                    if res and "error" not in res:
                        success += 1
                        res["round"] = round_name
                        records.append(res)
                    else:
                        failed += 1
                        errors.append((buffer_line, res["error"] if res else "Parsing failed"))
                buffer_line = line_str
            else:
                if buffer_line:
                    buffer_line += " " + line_str
                    
    # Process final buffer
    if buffer_line:
        res = parse_record_line(buffer_line, file_type)
        if res and "error" not in res:
            success += 1
            res["round"] = round_name
            records.append(res)
        else:
            failed += 1
            errors.append((buffer_line, res["error"] if res else "Parsing failed"))
            
    print(f"Parsed {round_name}: Success: {success}, Failed: {failed}")
    if failed > 0:
        print(f"First error in {round_name}: {errors[0][1]} | Line: {errors[0][0]}")
        raise ValueError(f"Failed to parse all rows in {round_name}!")
        
    return records

def main():
    pdf_dir = r"C:\Users\siddh\.gemini\antigravity\scratch\mp_dte"
    files = [
        ("CommonView.pdf", 1, "Round 1"),
        ("CommonView (1).pdf", 1, "Round 1 Upgrade"),
        ("CommonView (2).pdf", 2, "Round 2"),
        ("CommonView (3).pdf", 3, "Internal Branch Change")
    ]
    
    all_records = []
    for filename, file_type, round_name in files:
        path = os.path.join(pdf_dir, filename)
        if os.path.exists(path):
            records = process_pdf(path, file_type, round_name)
            all_records.extend(records)
        else:
            print(f"Warning: File not found {path}")
            
    print(f"Total compiled records: {len(all_records)}")
    
    # Write as JS array inside data.js
    output_path = os.path.join(pdf_dir, "data.js")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("const CUTOFF_DATA = ")
        json.dump(all_records, f, indent=2)
        f.write(";\n")
        
    print(f"Successfully wrote compiled data to {output_path}")

if __name__ == "__main__":
    main()
