type ColumnInfo = {
  name: string;
  type: string;
  comment: string;
};

function sqlTypeToGoType(sqlType: string): string {
  const t = sqlType.toLowerCase();
  if (t.includes('tinyint(1)')) return 'uint32';
  if (t.includes('int')) return 'int64';
  if (t.includes('bigint')) return 'int64';
  if (t.includes('varchar') || t.includes('text')) return 'string';
  if (t.includes('datetime') || t.includes('timestamp')) return 'time.Time';
  return 'string';
}

function toCamelCase(str: string): string {
  return str.replace(/(^|_)([a-z])/g, (_, __, c) => c.toUpperCase());
}

function extractTableName(sql: string): string {
  const match = sql.match(/CREATE TABLE\s+\S+\.\`(\w+)\`/i);
  return match ? match[1] : 'UnknownTable';
}

function parseColumns(sql: string): ColumnInfo[] {
  const columnRegex = /`(\w+)`\s+([\w()]+)[^,]*COMMENT\s+'([^']+)'/g;
  const columns: ColumnInfo[] = [];
  let match: RegExpExecArray | null;

  while ((match = columnRegex.exec(sql)) !== null) {
    columns.push({ name: match[1], type: match[2], comment: match[3] });
  }

  return columns;
}

export function generateGoFileFromSQL(sql: string): string {
  const tableName = extractTableName(sql);
  const structName = toCamelCase(tableName);
  const columns = parseColumns(sql);

  const goStructFields = columns
    .map((col) => {
      const goType = sqlTypeToGoType(col.type);
      const fieldName = toCamelCase(col.name);
      return `\t${fieldName} ${goType} \`orm:"column(${col.name})" description:"${col.comment}" json:"${col.name}"\``;
    })
    .join('\n\n');

  const goStruct = `type ${structName} struct {\n${goStructFields}\n}`;

  const serviceStruct = `
type ${structName}Service struct {
\ttableInfo *TableInfo
}

var T_${structName}Service *${structName}Service = &${structName}Service{
\ttableInfo: &TableInfo{
\t\tTableName: "${tableName}",
\t\tTpy:       reflect.TypeOf(${structName}{}),
\t},
}`;

  const serviceInit = `
func init() {
\t_TableMap["${tableName}"] = T_${structName}Service.tableInfo
}`;

  const methods = `
func (s *${structName}Service) Query(ctx context.Context, sessionId, query string, sortby interface{}, ascending interface{}) (*${structName}, int, error) {
\tinfo, errcode, err := s.tableInfo.DBWrap.Query(query, sortby, ascending)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] Query[%v] errcode[%v] err[%v] resp[%v]", sessionId, query, errcode, err, info))
\t}()
\tif err != nil {
\t\treturn nil, errcode, err
\t}
\treturn info.(*${structName}), errcode, err
}

func (s *${structName}Service) QueryPage(ctx context.Context, sessionId, query string, offset int, limit int, sortby interface{}, ascending interface{}) (int, []${structName}, int, error) {
\ttotal, info, errcode, err := s.tableInfo.DBWrap.QueryPage(query, offset, limit, sortby, ascending)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] QueryPage[%v] errcode[%v] err[%v] resp[%v]", sessionId, query, errcode, err, info))
\t}()
\tif err != nil {
\t\treturn 0, nil, errcode, err
\t}
\treturn total, info.([]${structName}), errcode, err
}

func (s *${structName}Service) QueryAll(ctx context.Context, sessionId, query string, sortby interface{}, ascending interface{}) ([]${structName}, int, error) {
\tinfo, errcode, err := s.tableInfo.DBWrap.QueryAll(query, sortby, ascending)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] QueryAll[%v] errcode[%v] err[%v] resp[%v]", sessionId, query, errcode, err, info))
\t}()
\tif err != nil {
\t\treturn nil, errcode, err
\t}
\treturn info.([]${structName}), errcode, err
}

func (s *${structName}Service) Update(ctx context.Context, sessionId string, key interface{}, info interface{}) (*${structName}, int, error) {
\tinfo, errcode, err := s.tableInfo.DBWrap.Update(key, info)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] Update[%v] errcode[%v] err[%v] resp[%v]", sessionId, key, errcode, err, info))
\t}()
\tif err != nil {
\t\treturn nil, errcode, err
\t}
\treturn info.(*${structName}), errcode, err
}

func (s *${structName}Service) Insert(ctx context.Context, sessionId string, info interface{}) (*${structName}, int, error) {
\tinfo, errcode, err := s.tableInfo.DBWrap.Insert(info)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] Insert errcode[%v] err[%v] resp[%v]", sessionId, errcode, err, info))
\t}()
\tif err != nil {
\t\treturn nil, errcode, err
\t}
\treturn info.(*${structName}), errcode, err
}

func (s *${structName}Service) Delete(ctx context.Context, sessionId string, key interface{}) (int, error) {
\terrcode, err := s.tableInfo.DBWrap.Delete(key)
\tdefer func() {
\t\tlogx.WithContext(ctx).Debug(fmt.Sprintf("[%v] Delete[%v] errcode[%v] err[%v]", sessionId, key, errcode, err))
\t}()

\treturn errcode, err
}`;

  const goFile = `package table

import (
\t"context"
\t"fmt"
\t"reflect"
\t"time"

\t"github.com/zeromicro/go-zero/core/logx"
)

${goStruct}

${serviceStruct}

${serviceInit}

${methods}`;

  return goFile;
}
