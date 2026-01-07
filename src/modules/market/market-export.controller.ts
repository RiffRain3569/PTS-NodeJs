import { BadRequestException, Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { MarketExportService } from './market-export.service';

@Controller('market')
export class MarketExportController {
    constructor(private readonly exportService: MarketExportService) {}

    @Get('export/page')
    getPage(@Res() res: Response) {
        const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Excel Export</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
            padding: 20px; 
            max-width: 600px; 
            margin: 0 auto; 
            background: #1e1b1e; /* Dark Brownish/Black from imagebg */
            color: #eeeeee;
        }
        .container { 
            background: #2a252a; /* Slightly lighter dark */
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 4px 6px rgba(0,0,0,0.3); 
            border: 1px solid #443c44;
        }
        h1 { 
            margin-top: 0; 
            color: #ffffff; 
            font-size: 24px; 
            border-bottom: 2px solid #8a1c1c; 
            padding-bottom: 10px;
            margin-bottom: 24px;
        }
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 500; color: #d0d0d0; }
        
        input, select { 
            width: 100%; 
            padding: 12px; 
            border: 1px solid #555; 
            border-radius: 4px; 
            font-size: 16px; 
            box-sizing: border-box; 
            background: #332f33;
            color: white;
        }
        input:focus, select:focus {
            outline: none;
            border-color: #a51d2d;
        }

        button { 
            width: 100%; 
            padding: 14px; 
            background: #a51d2d; /* Deep Red */
            color: white; 
            border: none; 
            border-radius: 4px; 
            font-size: 16px; 
            font-weight: 700; 
            cursor: pointer; 
            transition: background 0.2s; 
            margin-top: 10px;
        }
        button:hover { background: #c52233; }
        
        .checkbox-grid {
            display: grid;
            grid-template-columns: repeat(6, 1fr);
            gap: 10px;
            margin-top: 10px;
        }
        .checkbox-item {
            display: flex;
            align-items: center;
            justify-content: center;
            background: #332f33;
            border: 1px solid #555;
            border-radius: 4px;
            padding: 8px;
            cursor: pointer;
            user-select: none;
        }
        .checkbox-item input {
            display: none;
        }
        .checkbox-item.checked {
            background: #a51d2d;
            border-color: #a51d2d;
            color: white;
            font-weight: bold;
        }
        
        .note { 
            font-size: 12px; 
            color: #888; 
            margin-top: 20px; 
            text-align: center; 
            padding-top: 10px;
            border-top: 1px solid #444;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 Market Excel Export</h1>
        
        <div class="form-group">
            <label>Exchange</label>
            <select id="exchange">
                <option value="bithumb" selected>Bithumb</option>
                <option value="bitget">Bitget</option>
            </select>
        </div>

        <div class="form-group">
            <label>Start Date</label>
            <input type="date" id="startDate">
        </div>

        <div class="form-group">
            <label>End Date</label>
            <input type="date" id="endDate">
        </div>

        <div class="form-group">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <label style="margin-bottom: 0;">Target Hours</label>
                <div style="font-size: 14px;">
                    <a href="#" onclick="toggleAll(true); return false;" style="color: #a51d2d; text-decoration: none; margin-right: 10px;">전체 선택</a>
                    <a href="#" onclick="toggleAll(false); return false;" style="color: #888; text-decoration: none;">전체 해제</a>
                </div>
            </div>
            <div class="checkbox-grid" id="hourGrid">
                <!-- JS will populate 0-23 -->
            </div>
        </div>

        <button onclick="downloadExcel()">엑셀 다운로드 (Download)</button>
        <div class="note">
            TopN=5, Timezone=Asia/Seoul (Fixed)<br>
            LONG Only, Raw Format
        </div>
    </div>

    <script>
        // Set Default Date to Today
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('startDate').value = today;
        document.getElementById('endDate').value = today;

        // Generate Checkboxes
        const grid = document.getElementById('hourGrid');
        // Default selected hours: 1~6, 10~21
        const defaultHours = [1,2,3,4,5,6,10,11,12,13,14,15,16,17,18,19,20,21];

        for (let i = 0; i < 24; i++) {
            const div = document.createElement('div');
            div.className = 'checkbox-item';
            div.textContent = i + '시';
            div.dataset.value = i;
            
            if (defaultHours.includes(i)) {
                div.classList.add('checked');
            }

            div.onclick = function() {
                this.classList.toggle('checked');
            };
            grid.appendChild(div);
        }

        function toggleAll(check) {
            const items = document.querySelectorAll('.checkbox-item');
            items.forEach(item => {
                if (check) item.classList.add('checked');
                else item.classList.remove('checked');
            });
        }

        function downloadExcel() {
            const exchange = document.getElementById('exchange').value;
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            
            // Collect selected hours from class 'checked'
            const selectedHours = Array.from(document.querySelectorAll('.checkbox-item.checked'))
                                       .map(el => el.dataset.value);

            if (!startDate || !endDate) {
                alert('Dates are required');
                return;
            }
            if (selectedHours.length === 0) {
                alert('Please select at least one hour.');
                return;
            }

            // Batch Download
            let delay = 0;
            selectedHours.forEach(hour => {
                const url = \`/market/export/\${exchange}/top?startDate=\${startDate}&endDate=\${endDate}&targetHour=\${hour}&timezone=Asia/Seoul&topN=5\`;
                
                setTimeout(() => {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = url;
                    document.body.appendChild(iframe);
                    // Cleanup usage if needed, but for downloads usually fine to leave or remove after delay
                    setTimeout(() => document.body.removeChild(iframe), 60000); 
                }, delay);
                
                delay += 1000; // 1 second interval to avoid browser blocking
            });
            
            const msg = selectedHours.length + '개 파일 다운로드를 시작합니다 (순차 실행)';
            // console.log(msg);
        }
    </script>
</body>
</html>
        `;
        res.header('Content-Type', 'text/html');
        res.send(html);
    }

    @Get('export/:exchange/top')
    async exportTop(
        @Param('exchange') exchange: string,
        @Query() query: any,
        @Res({ passthrough: true }) res: Response
    ): Promise<void> {
        try {
            const {
                date,
                startDate,
                endDate,
                timezone = 'UTC',
                marketType,
                topN = 5,
                dedupSymbol = 'true',
                sortBy = 'id',
                hour,
                targetHour, // Supports both old and new param names if needed, or just switch
            } = query;

            // 1. Date Range Logic
            let finalStartDate: Date;
            let finalEndDate: Date;

            if (startDate) {
                finalStartDate = new Date(`${startDate}T00:00:00Z`); // Treat input as UTC date part or handle correctly?
                // Actually user inputs YYYY-MM-DD.
                // If we assume user input is in 'timezone' context, it gets complicated.
                // Usually date params are interpreted as YYYY-MM-DD in the REQUARER's view?
                // BUT standard API practice: YYYY-MM-DD implies 00:00 to 23:59 of that day.
                // The task says "date=YYYY-MM-DD -> 00:00 ~ 23:59:59".
                // Let's interpret YYYY-MM-DD as simple string and construct ISO string.
                // However, since we compare against `entry_time` (stored as Date/UTC),
                // we should probably convert these bounds to UTC or rely on string comparison if DB supports it.
                // Best practice: Convert YYYY-MM-DD to start of day in the requested `timezone`, then convert that instant to UTC Date object for DB query.
                // BUT, to keep it simple and effective (and since DB might use UTC):
                // Let's assume input dates are UTC-based dates (YYYY-MM-DD 00:00:00 UTC).
                // If user wants KST range, they should shift date or we accept that limitation.
                // OR, simplest: YYYY-MM-DD is UTC.

                finalStartDate = new Date(`${startDate}T00:00:00Z`);

                if (endDate) {
                    finalEndDate = new Date(`${endDate}T23:59:59.999Z`);
                } else {
                    finalEndDate = new Date(`${startDate}T23:59:59.999Z`);
                }
            } else if (date) {
                finalStartDate = new Date(`${date}T00:00:00Z`);
                finalEndDate = new Date(`${date}T23:59:59.999Z`);
            } else {
                throw new BadRequestException('date or startDate/endDate is required');
            }

            if (isNaN(finalStartDate.getTime()) || isNaN(finalEndDate.getTime())) {
                throw new BadRequestException('Invalid date format. Use YYYY-MM-DD');
            }

            // 2. Validate Other Params
            const parsedTopN = parseInt(topN, 10);
            const isDedup = dedupSymbol !== 'false';
            const validSortFields = ['exit_roi_pct', 'max_roi_pct', 'min_roi_pct', 'id'];
            if (!validSortFields.includes(sortBy)) {
                throw new BadRequestException(`Invalid sortBy. Must be one of ${validSortFields.join(', ')}`);
            }

            let parsedHour: number | undefined;
            // Support both 'hour' and 'targetHour' query params for convenience
            const rawHour = targetHour !== undefined ? targetHour : hour;

            if (rawHour !== undefined) {
                parsedHour = parseInt(rawHour, 10);
                if (isNaN(parsedHour) || parsedHour < 0 || parsedHour > 23) {
                    throw new BadRequestException('Invalid hour. Must be 0-23');
                }
            }

            // 3. Call Service
            console.log(`Generating Excel for ${exchange}...`);
            const excelBuffer = await this.exportService.exportTopN({
                startDate: finalStartDate,
                endDate: finalEndDate,
                exchange,
                timezone,
                topN: parsedTopN,
                dedupSymbol: isDedup,
                sortBy: sortBy as any,
                targetHour: parsedHour, // Pass as targetHour
            });
            console.log(`Excel generated. Buffer size: ${excelBuffer.length} bytes`);

            // 4. Response
            const filenameDate = startDate || date || 'export';
            const filename = `top${parsedTopN}_${exchange}_${filenameDate}${
                parsedHour !== undefined ? `_h${parsedHour}` : ''
            }.xlsx`;

            res.set({
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': `attachment; filename="${filename}"`,
                'Content-Length': excelBuffer.length.toString(),
            });

            res.end(excelBuffer);
        } catch (error: any) {
            console.error(error);
            // If headers sent, we can't send JSON error, but try/catch block usually catches before headers sent
            if (!res.headersSent) {
                res.status(error.status || 500).json({ error: error.message || 'Internal Server Error' });
            }
        }
    }
}
