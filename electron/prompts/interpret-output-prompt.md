Analyze the output of a terminal command. Extract real data from the output — numbers, sizes, names, counts, status — and return a structured JSON interpretation.

OUTPUT LANGUAGE: {language}. All text fields MUST be in this language.

Respond ONLY with valid JSON in this exact format:
{{"summary":"...","key_findings":["...","..."],"warnings":["..."],"errors":["..."],"recommendations":["..."],"successful":true|false}}

RULES:
- summary: 1 short sentence describing what happened
- key_findings: extract SPECIFIC values from the output (file names, sizes, counts, status). Max 5.
- warnings: actual warnings found in the output. Max 3.
- errors: actual errors found in the output. Max 3.
- recommendations: actionable next steps. Max 3.
- successful: true if command completed without errors
- NEVER invent data. Extract ONLY what is in the output.
- Output may contain ANSI escape codes — ignore them.

COMMAND CONTEXT (use to understand what the output means):
The command executed is: {command}. Use this to interpret the output correctly.

USER ENVIRONMENT:
{{environment_context}}
Use this to tailor your interpretation (e.g., mention the OS, Docker containers, or project context when relevant).

EXAMPLES:

Input: ls -lh
Output: total 1.2M
-rw-r--r-- 1 user user 800K Jan 15 10:30 data.csv
-rw-r--r-- 1 user user 128K Jan 15 10:30 readme.txt
-rwxr-xr-x 1 user user 75K Jan 15 10:30 script.sh

Response: {{"summary":"Listed 3 items totaling 1.0MB in directory","key_findings":["data.csv: 800KB","readme.txt: 128KB","script.sh: 75KB (executable)"],"warnings":[],"errors":[],"recommendations":["Large file data.csv (800KB) could be compressed"],"successful":true}}

Input: free -h
Output:               total        used        free      shared  buff/cache   available
Mem:           7.6Gi       3.2Gi       1.2Gi       0.1Gi       3.2Gi       4.0Gi
Swap:          2.0Gi          0B       2.0Gi

Response: {{"summary":"Memory: 7.6GB total, 3.2GB used (42%), 4.0GB available","key_findings":["Total: 7.6GB","Used: 3.2GB (42%)","Available: 4.0GB (53%)","Swap: 2.0GB total, 0B used"],"warnings":[],"errors":[],"recommendations":["Memory usage is healthy"],"successful":true}}

Input: cat broken.txt
Output: cat: broken.txt: No such file or directory

Response: {{"summary":"File not found","key_findings":[],"warnings":[],"errors":["broken.txt: No such file or directory"],"recommendations":["Verify the file path is correct","Check if the file exists with ls"],"successful":false}}
